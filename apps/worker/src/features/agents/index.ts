import { API_VERSION } from "@civicresolve/contracts/v1";
import {
  canPerformGlobalAction,
  canPerformOrganizationAction,
} from "@civicresolve/domain/permissions";
import {
  authenticateRequest,
  type AuthenticatedActor,
} from "../../auth/identity.js";
import { featureError, featureJson, sha256Hex } from "../shared.js";
import {
  attachFeedbackEvidence,
  uploadFeedbackEvidence,
} from "./feedback-evidence.js";
import {
  capabilityAnswer,
  currentJobPostingsAnswer,
  currentJobPostingsTool,
  isCapabilityQuestion,
  relevantToolForMessage,
} from "./guidance.js";
import { proposalChanges, type ProposalChange } from "./proposal-changes.js";
import { modelDeltas } from "./stream.js";
import {
  executeTool,
  prepareTool,
  ToolInputError,
  visibleTools,
} from "./tools.js";
import type {
  AgentContext,
  AgentMode,
  AiGeneration,
  ConversationRow,
  MessageRow,
  ProposalRow,
  ToolArguments,
} from "./types.js";

const MODEL = "@cf/ibm-granite/granite-4.0-h-micro";
const BASE = "/api/v1/agent/conversations";
const CONVERSATION_ID = /^conv_[a-f0-9]{32}$/;
const PROPOSAL_ID = /^proposal_[a-f0-9]{32}$/;
const MAX_MESSAGE = 4_000;
const MAX_ARGUMENTS = 20_000;
const HISTORY_LIMIT = 16;
const DAILY_INFERENCE_CAP = 200;

interface AgentRequestBody {
  mode?: unknown;
  locale?: unknown;
  organizationId?: unknown;
  message?: unknown;
  toolMentions?: unknown;
  tool?: unknown;
  args?: unknown;
  approved?: unknown;
  sandboxAcknowledged?: unknown;
  duplicateOverride?: unknown;
}

interface ModelInstruction {
  message?: unknown;
  tool?: { name?: unknown; args?: unknown };
}

export async function handleAgentRequest(
  request: Request,
  url: URL,
  context: AgentContext,
): Promise<Response | null> {
  if (url.pathname === BASE) {
    if (request.method === "POST") return createConversation(request, context);
    if (request.method === "GET") return listConversations(request, context);
    return featureError(context, "METHOD_NOT_ALLOWED", "Use GET or POST.", 405);
  }
  if (!url.pathname.startsWith(`${BASE}/`)) return null;
  const path = url.pathname.slice(BASE.length + 1).split("/");
  const id = path[0];
  if (!id || !CONVERSATION_ID.test(id))
    return featureError(context, "NOT_FOUND", "Conversation not found.", 404);
  const conversation = await loadConversation(request, id, context);
  if (conversation instanceof Response) return conversation;

  if (
    path.length === 2 &&
    path[1] === "feedback-evidence" &&
    request.method === "POST"
  )
    return uploadFeedbackEvidence(request, conversation, context);
  if (path.length === 1 && request.method === "GET")
    return conversationView(conversation, context);
  if (path.length === 2 && path[1] === "messages" && request.method === "POST")
    return sendMessage(request, conversation, context);
  if (
    path.length === 3 &&
    path[1] === "messages" &&
    path[2] === "stream" &&
    request.method === "POST"
  )
    return streamMessage(request, conversation, context);
  if (path.length === 2 && path[1] === "tools" && request.method === "POST")
    return invokeTool(request, conversation, context);
  if (
    path.length === 4 &&
    path[1] === "proposals" &&
    PROPOSAL_ID.test(path[2] ?? "")
  ) {
    if (path[3] === "feedback-evidence" && request.method === "POST")
      return attachFeedbackEvidence(request, conversation, path[2]!, context);
    if (path[3] === "approve" && request.method === "POST")
      return approveProposal(request, conversation, path[2]!, context);
    if (path[3] === "reject" && request.method === "POST")
      return rejectProposal(conversation, path[2]!, context);
  }
  return featureError(context, "NOT_FOUND", "Agent action not found.", 404);
}

async function createConversation(
  request: Request,
  context: AgentContext,
): Promise<Response> {
  const body = await jsonBody(request);
  const mode = body?.mode;
  const locale = body?.locale === "fr" ? "fr" : "en";
  if (mode !== "resident" && mode !== "employee")
    return featureError(
      context,
      "INVALID_REQUEST",
      "Choose resident or employee mode.",
      400,
    );
  const actor = await authenticateRequest(request, context.env);
  if (mode === "employee" && !isEmployee(actor))
    return featureError(
      context,
      "FORBIDDEN",
      "An employee organization role is required.",
      403,
    );
  let organizationId: string | null = null;
  if (mode === "employee") {
    organizationId = actor!.organizationId;
    if (
      !organizationId &&
      canPerformGlobalAction(actor!, "taxonomy:manage") &&
      typeof body?.organizationId === "string" &&
      /^[A-Za-z0-9_-]{1,120}$/.test(body.organizationId)
    ) {
      const organization = await context.env.DB.prepare(
        "SELECT id FROM organizations WHERE id = ?",
      )
        .bind(body.organizationId)
        .first<{ id: string }>();
      organizationId = organization?.id ?? null;
    }
    if (!organizationId && !canPerformGlobalAction(actor!, "source:manage"))
      return featureError(
        context,
        "INVALID_REQUEST",
        "Choose an organization.",
        400,
      );
  }
  const guestToken = actor ? null : randomHex(32);
  const now = new Date().toISOString();
  const id = `conv_${randomHex(16)}`;
  await context.env.DB.prepare(
    `INSERT INTO agent_conversations
      (id, mode, locale, owner_subject, guest_token_hash, organization_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      mode,
      locale,
      actor?.subject ?? null,
      guestToken ? await sha256Hex(guestToken) : null,
      organizationId,
      now,
      now,
    )
    .run();
  return featureJson(
    context,
    {
      apiVersion: API_VERSION,
      conversation: {
        id,
        mode,
        locale,
        organizationId,
        createdAt: now,
        updatedAt: now,
      },
      ...(guestToken ? { conversationToken: guestToken } : {}),
      tools: visibleTools(mode, organizationId),
    },
    201,
  );
}

async function listConversations(
  request: Request,
  context: AgentContext,
): Promise<Response> {
  const actor = await authenticateRequest(request, context.env);
  if (!actor)
    return featureError(
      context,
      "UNAUTHENTICATED",
      "Sign in to list conversations.",
      401,
    );
  const rows = await context.env.DB.prepare(
    `SELECT id, mode, locale, owner_subject, guest_token_hash, organization_id, created_at, updated_at
     FROM agent_conversations WHERE owner_subject = ? ORDER BY updated_at DESC LIMIT 50`,
  )
    .bind(actor.subject)
    .all<ConversationRow>();
  return featureJson(context, {
    apiVersion: API_VERSION,
    conversations: (rows.results ?? []).map(conversationSummary),
  });
}

async function loadConversation(
  request: Request,
  id: string,
  context: AgentContext,
): Promise<ConversationRow | Response> {
  const row = await context.env.DB.prepare(
    `SELECT id, mode, locale, owner_subject, guest_token_hash, organization_id, created_at, updated_at
     FROM agent_conversations WHERE id = ?`,
  )
    .bind(id)
    .first<ConversationRow>();
  if (!row)
    return featureError(context, "NOT_FOUND", "Conversation not found.", 404);
  const actor = await authenticateRequest(request, context.env);
  if (row.owner_subject) {
    if (!actor || row.owner_subject !== actor.subject)
      return featureError(context, "NOT_FOUND", "Conversation not found.", 404);
  } else {
    const token = request.headers.get("X-Conversation-Token");
    if (
      !token ||
      !row.guest_token_hash ||
      (await sha256Hex(token)) !== row.guest_token_hash
    )
      return featureError(context, "NOT_FOUND", "Conversation not found.", 404);
  }
  if (
    row.mode === "employee" &&
    (!isEmployee(actor) ||
      (row.organization_id === null
        ? !canPerformGlobalAction(actor, "source:manage")
        : actor.organizationId !== row.organization_id &&
          !canPerformGlobalAction(actor, "taxonomy:manage")))
  )
    return featureError(context, "FORBIDDEN", "Employee access changed.", 403);
  return row;
}

async function conversationView(
  conversation: ConversationRow,
  context: AgentContext,
): Promise<Response> {
  const [messages, proposals] = await Promise.all([
    context.env.DB.prepare(
      `SELECT id, conversation_id, role, content, tool_name, created_at FROM agent_messages
       WHERE conversation_id = ? ORDER BY created_at, id LIMIT 100`,
    )
      .bind(conversation.id)
      .all<MessageRow>(),
    context.env.DB.prepare(
      `SELECT id, conversation_id, tool_name, args_json, preview_json, status, result_json, created_at, expires_at, decided_at
       FROM agent_proposals WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 50`,
    )
      .bind(conversation.id)
      .all<ProposalRow>(),
  ]);
  return featureJson(context, {
    apiVersion: API_VERSION,
    conversation: conversationSummary(conversation),
    messages: (messages.results ?? []).map(messageView),
    proposals: (proposals.results ?? []).map(proposalView),
    tools: visibleTools(conversation.mode, conversation.organization_id),
  });
}

async function sendMessage(
  request: Request,
  conversation: ConversationRow,
  context: AgentContext,
  deferAssistant = false,
): Promise<Response> {
  const body = await jsonBody(request);
  const mentionedTools = allowedToolMentions(body?.toolMentions, conversation);
  if (!mentionedTools)
    return featureError(
      context,
      "INVALID_TOOL_MENTIONS",
      "Choose at most three available tools.",
      400,
    );
  const message = body?.message;
  if (
    typeof message !== "string" ||
    !message.trim() ||
    message.length > MAX_MESSAGE
  )
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a message up to 4,000 characters.",
      400,
    );
  const safeMessage = redactSecrets(message.trim());
  if (isCapabilityQuestion(safeMessage) && mentionedTools.length === 0) {
    const answer = capabilityAnswer(
      conversation.mode,
      conversation.locale,
      conversation.organization_id,
    );
    await storeMessage(conversation.id, "user", safeMessage, context);
    if (!deferAssistant)
      await storeMessage(conversation.id, "assistant", answer, context);
    return featureJson(context, { apiVersion: API_VERSION, message: answer });
  }
  const vacancyTool =
    mentionedTools.length === 0
      ? currentJobPostingsTool(safeMessage)
      : undefined;
  if (vacancyTool) {
    const outcome = await callTool(
      request,
      conversation,
      vacancyTool.name,
      vacancyTool.args,
      context,
    );
    if (outcome instanceof Response) return outcome;
    const result = outcome.result as
      | { status: number; data: unknown }
      | undefined;
    if (!result || result.status >= 400)
      return featureError(
        context,
        "SOURCE_UNAVAILABLE",
        "Current postings could not be checked right now.",
        503,
      );
    const answer = currentJobPostingsAnswer(
      result.data,
      conversation.locale,
      vacancyTool.args,
    );
    await storeMessage(conversation.id, "user", safeMessage, context);
    if (!deferAssistant)
      await storeMessage(conversation.id, "assistant", answer, context);
    return featureJson(context, {
      apiVersion: API_VERSION,
      message: answer,
      toolResult: result,
      groundedRead: true,
    });
  }
  if (!context.env.AI)
    return featureError(
      context,
      "AI_UNAVAILABLE",
      "Conversation is temporarily unavailable.",
      503,
    );
  if (!(await reserveAiCall(context)))
    return featureError(
      context,
      "AI_DAILY_LIMIT",
      "Conversation is at its daily usage limit. Try again tomorrow.",
      429,
    );
  await storeMessage(conversation.id, "user", safeMessage, context);
  const history = await context.env.DB.prepare(
    `SELECT id, conversation_id, role, content, tool_name, created_at FROM agent_messages
     WHERE conversation_id = ? AND role != 'tool' ORDER BY created_at DESC, id DESC LIMIT ?`,
  )
    .bind(conversation.id, HISTORY_LIMIT)
    .all<MessageRow>();
  const recent = (history.results ?? []).reverse();
  let response: AiGeneration;
  try {
    response = await context.env.AI.run(MODEL, {
      messages: [
        {
          role: "system",
          content:
            systemPrompt(conversation) +
            (mentionedTools.length
              ? `\nThe person explicitly selected these available tools: ${mentionedTools.join(", ")}. Choose at most one selected tool when relevant. Use only arguments supported by that tool.`
              : ""),
        },
        ...recent.map((item) => ({
          role: item.role as "user" | "assistant",
          content: item.content,
        })),
      ],
      max_tokens: 450,
      temperature: 0.2,
    });
  } catch {
    return featureError(
      context,
      "AI_UNAVAILABLE",
      "Conversation is temporarily unavailable.",
      503,
    );
  }
  const instruction = parseInstruction(modelText(response));
  if (
    mentionedTools.length === 1 &&
    instruction.tool?.name !== mentionedTools[0]
  )
    instruction.tool = { name: mentionedTools[0]!, args: {} };
  if (
    mentionedTools.length > 1 &&
    instruction.tool &&
    !mentionedTools.includes(instruction.tool.name)
  )
    delete instruction.tool;
  let assistantText = instruction.message;
  let toolResult: unknown;
  let proposal: unknown;
  const previousMessages = recent.slice(0, -1);
  const previousAssistant = [...previousMessages]
    .reverse()
    .find((item) => item.role === "assistant")?.content;
  const previousIssue = [...previousMessages]
    .reverse()
    .find(
      (item) =>
        item.role === "user" &&
        (suggestsServiceIssue(item.content) ||
          requestsFeedbackPreparation(item.content)),
    )?.content;
  const clarifiesToronto =
    /\bToronto\b/i.test(safeMessage) &&
    /which municipality|dans quelle municipalité/i.test(
      previousAssistant ?? "",
    ) &&
    !!previousIssue;
  const confirmsSeparateIssue =
    isSeparateIssueConfirmation(safeMessage) &&
    /matching report already exists|signalement semblable existe déjà/i.test(
      previousAssistant ?? "",
    ) &&
    !!previousIssue;
  const resumesFeedbackPreparation =
    requestsFeedbackPreparation(safeMessage) &&
    /feedback preview|report draft|proposal card|aperçu du signalement|brouillon du signalement/i.test(
      previousAssistant ?? "",
    ) &&
    !!previousIssue;
  const residentIssueText =
    conversation.mode === "resident"
      ? clarifiesToronto || confirmsSeparateIssue || resumesFeedbackPreparation
        ? previousIssue
        : suggestsServiceIssue(safeMessage) ||
            requestsFeedbackPreparation(safeMessage) ||
            mentionedTools.includes("create_feedback")
          ? safeMessage
          : null
      : null;
  const residentServiceIssue = !!residentIssueText;
  const selectedTool = relevantToolForMessage(safeMessage, instruction.tool);
  const narrowedJobSearch = selectedTool !== instruction.tool;
  if (selectedTool && !residentServiceIssue) {
    const outcome = await callTool(
      request,
      conversation,
      selectedTool.name,
      selectedTool.args,
      context,
    );
    if (outcome instanceof Response) {
      toolResult = {
        status: outcome.status,
        data: (await outcome.json()) as unknown,
      };
    } else {
      toolResult = outcome.result;
      proposal = outcome.proposal;
    }
  }
  if (
    narrowedJobSearch &&
    (toolResult as { status?: number })?.status === 200
  ) {
    const result = (toolResult as { data?: { items?: unknown[] } }).data;
    assistantText =
      result?.items?.length === 0
        ? conversation.locale === "fr"
          ? "Je n'ai trouvé aucune offre d'emploi correspondante parmi les sources publiées."
          : "I found no matching jobs among the published sources."
        : conversation.locale === "fr"
          ? "Voici les résultats d'emploi correspondant à votre recherche et leurs sources officielles."
          : "Here are matching jobs and their official sources.";
  }
  if (
    toolResult &&
    !proposal &&
    !feedbackDuplicateStatus(toolResult) &&
    selectedTool?.name !== "prepare_feedback_evidence_upload"
  ) {
    const result = toolResult as { status?: number; data?: unknown };
    if (result.status && result.status < 400 && context.env.AI) {
      try {
        if (!(await reserveAiCall(context)))
          throw new Error("Daily AI limit reached");
        const followUp = await context.env.AI.run(MODEL, {
          messages: [
            {
              role: "system",
              content: `Answer the user in ${conversation.locale === "fr" ? "French" : "English"} from the tool result. Do not invent facts. Keep it brief. Never include secrets.`,
            },
            { role: "user", content: safeMessage },
            {
              role: "assistant",
              content: `Tool result: ${JSON.stringify(result.data).slice(0, 12_000)}`,
            },
          ],
          max_tokens: 450,
          temperature: 0.2,
        });
        const followUpText = modelText(followUp);
        if (followUpText?.trim()) assistantText = followUpText.trim();
      } catch {
        /* The successful tool result is still returned to the client. */
      }
    }
  }
  if (
    selectedTool?.name === "prepare_feedback_evidence_upload" &&
    (toolResult as { status?: number } | undefined)?.status === 200
  )
    assistantText =
      conversation.locale === "fr"
        ? "Choisissez un fichier PDF, PNG ou JPEG à joindre au brouillon. Rien ne sera envoyé avant votre approbation."
        : "Choose a PDF, PNG, or JPEG to attach to the draft. Nothing is submitted until you approve it.";
  const selectedDuplicate = feedbackDuplicateStatus(toolResult);
  if (selectedDuplicate)
    assistantText = duplicateMessage(selectedDuplicate, conversation.locale);
  if (residentIssueText) {
    if (appearsEmergency(residentIssueText)) {
      assistantText =
        conversation.locale === "fr"
          ? "En cas de danger immédiat, appelez le 911. Je peux vous aider à préparer un signalement ensuite."
          : "If there is immediate danger, call 911. I can help prepare a report afterward.";
    } else if (
      /\bToronto\b/i.test(residentIssueText) ||
      clarifiesToronto ||
      confirmsSeparateIssue ||
      resumesFeedbackPreparation
    ) {
      assistantText =
        conversation.locale === "fr"
          ? "Je peux vous aider à préparer un signalement pour ce problème."
          : "I can help prepare a report about this problem.";
      const feedbackArgs = {
        message: residentIssueText,
        municipalityId: "3520005",
        sandboxAcknowledged: false,
        locale: conversation.locale,
      };
      const check = await checkFeedbackDuplicate(
        request,
        feedbackArgs,
        conversation,
        context,
      );
      if (check instanceof Response) {
        toolResult = {
          status: check.status,
          data: (await check.json()) as unknown,
        };
        assistantText =
          conversation.locale === "fr"
            ? "Je ne peux pas vérifier les signalements semblables pour le moment. Réessayez bientôt."
            : "I cannot check for matching reports right now. Please try again soon.";
      } else if (check && !confirmsSeparateIssue) {
        toolResult = duplicateResult(check);
        assistantText = duplicateMessage(check, conversation.locale);
      } else {
        const draft = await callTool(
          request,
          conversation,
          "create_feedback",
          feedbackArgs,
          context,
          check,
        );
        if (draft instanceof Response) {
          toolResult = {
            status: draft.status,
            data: (await draft.json()) as unknown,
          };
          assistantText =
            conversation.locale === "fr"
              ? "Je ne peux pas préparer ce signalement pour le moment. Réessayez bientôt."
              : "I cannot prepare this report right now. Please try again soon.";
        } else {
          toolResult = draft.result;
          proposal = draft.proposal;
          const duplicate = feedbackDuplicateStatus(toolResult);
          assistantText = duplicate
            ? conversation.locale === "fr"
              ? "J'ai préparé un signalement distinct. Vérifiez le brouillon et confirmez qu'il s'agit d'un autre problème avant de l'envoyer."
              : "I prepared a separate report. Review the draft and confirm this is a distinct issue before sending it."
            : conversation.locale === "fr"
              ? "Je peux vous aider à signaler ce problème. Vérifiez le brouillon avant de l'envoyer."
              : "You can report this problem through Envoy. Review the draft before sending it.";
        }
      }
    } else {
      assistantText =
        conversation.locale === "fr"
          ? "Dans quelle municipalité cela s'est-il passé? Je peux vous aider à préparer un signalement."
          : "Which municipality did this happen in? I can help prepare a report.";
    }
  }
  if (proposal && !residentIssueText)
    assistantText =
      conversation.locale === "fr"
        ? "L'aperçu de l'action est prêt. Vérifiez-le avant de l'approuver."
        : "The action preview is ready. Review it before approving.";
  const toolStatus = (toolResult as { status?: number } | undefined)?.status;
  if (
    !proposal &&
    (claimsUnverifiedAction(assistantText) ||
      ((toolStatus === undefined || toolStatus >= 400) &&
        /\b(?:preview|proposal|draft|prepared|created|submitted|sent|filed|published|updated|closed|uploaded|attached)\b/i.test(
          assistantText,
        )))
  )
    assistantText =
      conversation.locale === "fr"
        ? "Je n'ai pas préparé d'aperçu pour le moment. Décrivez le problème et sa municipalité pour que je puisse le préparer."
        : "I haven't prepared a preview yet. Describe the issue and municipality so I can prepare one.";
  assistantText = redactSecrets(assistantText)
    .replace(/\p{Extended_Pictographic}/gu, "")
    .trim();
  if (!deferAssistant)
    await storeMessage(conversation.id, "assistant", assistantText, context);
  return featureJson(context, {
    apiVersion: API_VERSION,
    message: assistantText,
    ...(toolResult ? { toolResult } : {}),
    ...(proposal ? { proposal } : {}),
  });
}

async function streamMessage(
  request: Request,
  conversation: ConversationRow,
  context: AgentContext,
): Promise<Response> {
  const planned = await sendMessage(request, conversation, context, true);
  if (!planned.ok) return planned;
  const envelope = (await planned.json()) as {
    apiVersion: string;
    message: string;
    toolResult?: unknown;
    proposal?: unknown;
    groundedRead?: boolean;
  };
  const draft = envelope.message;
  const toolStatus = (envelope.toolResult as { status?: unknown } | undefined)
    ?.status;
  const toolFailed = typeof toolStatus === "number" && toolStatus >= 400;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let disconnected = false;
      const send = (event: string, value: unknown) => {
        if (disconnected) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`,
            ),
          );
        } catch {
          disconnected = true;
        }
      };
      let answer = "";
      try {
        if (toolFailed) {
          answer = draft;
        } else if (envelope.groundedRead) {
          answer = draft;
          send("text", { delta: draft });
        } else if (context.env.AI && (await reserveAiCall(context))) {
          const generated = await context.env.AI.run(MODEL, {
            messages: [
              {
                role: "system",
                content: `You are Envoy's ${conversation.mode} assistant. Rewrite the supplied draft as one or two short natural sentences in ${conversation.locale === "fr" ? "French" : "English"}. Output plain text only. Preserve every fact and condition. Add no facts, URLs, actions, results, or emoji. If the draft says a preview is ready, say only that it is ready for review; never say it was submitted. Never reveal tokens.`,
              },
              { role: "user", content: draft },
            ],
            max_tokens: 180,
            temperature: 0,
            stream: true,
          });
          for await (const delta of modelDeltas(generated)) {
            if (answer.length + delta.length > MAX_MESSAGE) break;
            answer += delta;
            send("text", { delta });
          }
        }
      } catch {
        // The planner result remains valid when a streaming inference fails.
      }
      answer = redactSecrets(answer)
        .replace(/\p{Extended_Pictographic}/gu, "")
        .trim();
      if (!answer || (!envelope.proposal && claimsUnverifiedAction(answer)))
        answer = draft;
      try {
        await storeMessage(conversation.id, "assistant", answer, context);
        send("final", { ...envelope, message: answer });
      } catch {
        send("error", {
          code: "CONVERSATION_UNAVAILABLE",
          message: "Conversation is temporarily unavailable.",
        });
      }
      send("done", {});
      if (!disconnected) controller.close();
    },
  });
  const headers = new Headers(context.cors);
  headers.set("Content-Type", "text/event-stream; charset=utf-8");
  headers.set("Cache-Control", "no-store, no-transform");
  headers.set("X-Accel-Buffering", "no");
  return new Response(stream, { headers });
}

async function invokeTool(
  request: Request,
  conversation: ConversationRow,
  context: AgentContext,
): Promise<Response> {
  const body = await jsonBody(request);
  if (typeof body?.tool !== "string" || !isArguments(body.args))
    return featureError(
      context,
      "INVALID_REQUEST",
      "Provide a tool name and arguments object.",
      400,
    );
  const outcome = await callTool(
    request,
    conversation,
    body.tool,
    body.args,
    context,
  );
  if (outcome instanceof Response) return outcome;
  return featureJson(
    context,
    { apiVersion: API_VERSION, ...outcome },
    outcome.proposal ? 201 : 200,
  );
}

async function callTool(
  request: Request,
  conversation: ConversationRow,
  name: string,
  args: ToolArguments,
  context: AgentContext,
  precheckedDuplicate?: string | null,
): Promise<{ result?: unknown; proposal?: unknown } | Response> {
  if (JSON.stringify(args).length > MAX_ARGUMENTS)
    return featureError(
      context,
      "INVALID_REQUEST",
      "Tool arguments are too large.",
      400,
    );
  let prepared: ReturnType<typeof prepareTool>;
  try {
    prepared = prepareTool(
      name,
      args,
      conversation.mode,
      conversation.organization_id,
      conversation.id,
    );
  } catch (error) {
    if (error instanceof ToolInputError)
      return featureError(context, "INVALID_TOOL_INPUT", error.message, 400);
    throw error;
  }
  if (
    name === "propose_source_correction" ||
    name === "decide_source_correction"
  ) {
    const actor = await authenticateRequest(request, context.env);
    if (!actor || !canPerformGlobalAction(actor, "source:manage"))
      return featureError(
        context,
        "FORBIDDEN",
        "Source curator access required.",
        403,
      );
  }
  if (name === "prepare_feedback_evidence_upload") {
    const pending = await context.env.DB.prepare(
      `SELECT id FROM agent_proposals
       WHERE conversation_id = ? AND tool_name = 'create_feedback'
         AND status = 'pending' AND expires_at > ? LIMIT 1`,
    )
      .bind(conversation.id, new Date().toISOString())
      .first<{ id: string }>();
    if (!pending)
      return featureError(
        context,
        "FEEDBACK_PROPOSAL_REQUIRED",
        "Prepare a feedback preview before attaching evidence.",
        409,
      );
  }
  if (prepared.tool.access === "read") {
    const result = await executeTool(
      request,
      context,
      prepared,
      request.headers.get("X-Receipt-Token") ?? undefined,
    );
    if (name === "prepare_resume_upload" && result.status < 400)
      return {
        result: {
          status: result.status,
          data: {
            ...(result.data as Record<string, unknown>),
            upload: {
              path: "/api/v1/profile/resumes",
              method: "POST",
              contentType: "multipart/form-data",
              field: "file",
              requiresFileChooser: true,
              submitted: false,
            },
          },
        },
      };
    return { result };
  }
  const now = new Date();
  const id = `proposal_${randomHex(16)}`;
  const expiresAt = new Date(now.getTime() + 30 * 60_000).toISOString();
  let duplicateStatus: string | null = null;
  if (name === "create_feedback") {
    const check =
      precheckedDuplicate === undefined
        ? await checkFeedbackDuplicate(request, args, conversation, context)
        : precheckedDuplicate;
    if (check instanceof Response) return check;
    duplicateStatus = check;
  }
  let programSample = false;
  if (name === "submit_program_application") {
    const program = await executeTool(
      request,
      context,
      prepareTool(
        "read_program",
        { id: args.programId },
        conversation.mode,
        conversation.organization_id,
      ),
    );
    if (program.status >= 400)
      return featureJson(
        context,
        { apiVersion: API_VERSION, result: program },
        program.status,
      );
    const record = (program.data as { program?: { sample?: unknown } }).program;
    programSample = record?.sample === true;
  }
  const preview = {
    ...prepared.preview,
    organizationId: conversation.organization_id,
    requiresApproval: true,
    expiresAt,
    ...(name === "create_feedback"
      ? {
          requiresSandboxAcknowledgment: true,
          requiresDuplicateOverride: duplicateStatus !== null,
          ...(duplicateStatus ? { duplicateStatus } : {}),
          destinationNotice:
            "This report goes only to Envoy's Toronto intake queue. It is not connected to a government office.",
        }
      : {}),
    ...(name === "submit_program_application"
      ? {
          requiresSandboxAcknowledgment: programSample,
          destinationNotice: programSample
            ? "This is a practice sponsor. The application stays in Envoy and does not reach a government agency."
            : "This is a first-party application to the participating sponsor named on the program.",
        }
      : {}),
    ...(await recordVersion(request, name, args, conversation, context)),
  };
  await context.env.DB.prepare(
    `INSERT INTO agent_proposals
      (id, conversation_id, tool_name, args_json, preview_json, status, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
  )
    .bind(
      id,
      conversation.id,
      name,
      JSON.stringify(proposalArguments(name, args)),
      JSON.stringify(preview),
      now.toISOString(),
      expiresAt,
    )
    .run();
  return {
    proposal: { id, status: "pending", preview },
    ...(duplicateStatus ? { result: duplicateResult(duplicateStatus) } : {}),
  };
}

async function approveProposal(
  request: Request,
  conversation: ConversationRow,
  proposalId: string,
  context: AgentContext,
): Promise<Response> {
  const body = await jsonBody(request);
  if (body?.approved !== true)
    return featureError(
      context,
      "APPROVAL_REQUIRED",
      "Explicit approval is required.",
      400,
    );
  const proposal = await getProposal(conversation.id, proposalId, context);
  if (!proposal)
    return featureError(context, "NOT_FOUND", "Proposal not found.", 404);
  if (proposal.status === "rejected")
    return featureError(
      context,
      "PROPOSAL_REJECTED",
      "Proposal was rejected.",
      409,
    );
  if (proposal.status === "approved") {
    const result = JSON.parse(proposal.result_json ?? "null") as {
      status?: number;
      data?: unknown;
    } | null;
    if (
      proposal.tool_name === "create_feedback" &&
      result?.data &&
      typeof result.data === "object"
    ) {
      const secret = context.env.FEEDBACK_ABUSE_HMAC_KEY;
      if (secret && secret.length >= 32)
        result.data = {
          ...result.data,
          receiptToken: await deterministicReceiptToken(secret, proposal.id),
        };
    }
    return featureJson(context, {
      apiVersion: API_VERSION,
      proposal: proposalView(proposal),
      result,
    });
  }
  if (new Date(proposal.expires_at).getTime() < Date.now())
    return featureError(
      context,
      "PROPOSAL_EXPIRED",
      "Prepare this action again.",
      409,
    );
  const args = JSON.parse(proposal.args_json) as ToolArguments;
  const feedbackEvidenceAssetIds =
    proposal.tool_name === "create_feedback" ? proposalEvidenceIds(args) : [];
  if (feedbackEvidenceAssetIds === null)
    return featureError(
      context,
      "INVALID_PROPOSAL",
      "This feedback proposal must be prepared again.",
      409,
    );
  let prepared: ReturnType<typeof prepareTool>;
  try {
    prepared = prepareTool(
      proposal.tool_name,
      args,
      conversation.mode,
      conversation.organization_id,
    );
  } catch {
    return featureError(
      context,
      "INVALID_TOOL_INPUT",
      "This action is no longer available.",
      409,
    );
  }
  if (prepared.tool.access !== "write")
    return featureError(
      context,
      "INVALID_REQUEST",
      "This proposal is not a write.",
      400,
    );
  const preview = JSON.parse(proposal.preview_json) as {
    recordVersion?: string;
    requiresSandboxAcknowledgment?: boolean;
    requiresDuplicateOverride?: boolean;
    duplicateStatus?: string;
  };
  if (preview.recordVersion) {
    const latest = await recordVersion(
      request,
      proposal.tool_name,
      args,
      conversation,
      context,
    );
    if (latest.recordVersion !== preview.recordVersion)
      return featureError(
        context,
        "STALE_PROPOSAL",
        "This record changed. Prepare the action again.",
        409,
      );
  }
  if (
    preview.requiresSandboxAcknowledgment === true &&
    body.sandboxAcknowledged !== true
  )
    return featureError(
      context,
      "SANDBOX_ACK_REQUIRED",
      "Confirm the practice destination shown in the action preview.",
      409,
    );
  if (proposal.tool_name === "create_feedback") {
    const check = await checkFeedbackDuplicate(
      request,
      args,
      conversation,
      context,
    );
    if (check instanceof Response) return check;
    if (
      check &&
      (!preview.requiresDuplicateOverride || body.duplicateOverride !== true)
    ) {
      const updated = await noteDuplicateOnProposal(
        proposal,
        preview,
        check,
        context,
      );
      return pendingDuplicateResponse(context, proposal.id, updated, check);
    }
    if (preview.requiresDuplicateOverride && body.duplicateOverride !== true) {
      if (!preview.duplicateStatus)
        return featureError(
          context,
          "STALE_PROPOSAL",
          "Prepare this report again before submitting.",
          409,
        );
      return pendingDuplicateResponse(
        context,
        proposal.id,
        preview,
        preview.duplicateStatus,
      );
    }
  }
  if (
    proposal.tool_name === "create_feedback" &&
    prepared.body &&
    typeof prepared.body === "object"
  )
    prepared.body = {
      ...prepared.body,
      sandboxAcknowledged: true,
      duplicateOverride:
        preview.requiresDuplicateOverride === true &&
        body.duplicateOverride === true,
      ...(feedbackEvidenceAssetIds.length > 0
        ? { feedbackEvidenceAssetIds }
        : {}),
    };
  if (
    proposal.tool_name === "submit_program_application" &&
    prepared.body &&
    typeof prepared.body === "object"
  )
    prepared.body = {
      ...prepared.body,
      sandboxAcknowledged: body.sandboxAcknowledged === true,
    };
  let receiptToken = request.headers.get("X-Receipt-Token") ?? undefined;
  if (proposal.tool_name === "create_feedback") {
    const secret = context.env.FEEDBACK_ABUSE_HMAC_KEY;
    if (!secret || secret.length < 32)
      return featureError(
        context,
        "FEEDBACK_UNAVAILABLE",
        "Feedback is temporarily unavailable.",
        503,
      );
    receiptToken = await deterministicReceiptToken(secret, proposal.id);
  }
  const result = await executeTool(
    request,
    context,
    prepared,
    receiptToken,
    `agent-proposal-${proposal.id}`,
    proposal.tool_name === "create_feedback" ? conversation.id : undefined,
  );
  if (result.status >= 400)
    return featureJson(
      context,
      { apiVersion: API_VERSION, result },
      result.status,
    );
  if (proposal.tool_name === "create_feedback") {
    const racedDuplicate = feedbackDuplicateStatus(result);
    if (racedDuplicate) {
      const updated = await noteDuplicateOnProposal(
        proposal,
        preview,
        racedDuplicate,
        context,
      );
      return pendingDuplicateResponse(
        context,
        proposal.id,
        updated,
        racedDuplicate,
      );
    }
  }
  const stored =
    proposal.tool_name === "create_feedback"
      ? { ...result, data: stripReceiptToken(result.data) }
      : result;
  const now = new Date().toISOString();
  await context.env.DB.prepare(
    `UPDATE agent_proposals SET status = 'approved', result_json = ?, decided_at = ?
     WHERE id = ? AND conversation_id = ? AND status = 'pending'`,
  )
    .bind(JSON.stringify(stored), now, proposal.id, conversation.id)
    .run();
  return featureJson(context, {
    apiVersion: API_VERSION,
    proposal: { id: proposal.id, status: "approved" },
    result,
  });
}

async function rejectProposal(
  conversation: ConversationRow,
  proposalId: string,
  context: AgentContext,
): Promise<Response> {
  const proposal = await getProposal(conversation.id, proposalId, context);
  if (!proposal)
    return featureError(context, "NOT_FOUND", "Proposal not found.", 404);
  if (proposal.status === "approved")
    return featureError(
      context,
      "ALREADY_APPROVED",
      "This action has already run.",
      409,
    );
  await context.env.DB.prepare(
    `UPDATE agent_proposals SET status = 'rejected', decided_at = ?
     WHERE id = ? AND conversation_id = ? AND status = 'pending'`,
  )
    .bind(new Date().toISOString(), proposalId, conversation.id)
    .run();
  return featureJson(context, {
    apiVersion: API_VERSION,
    proposal: { id: proposalId, status: "rejected" },
  });
}

async function getProposal(
  conversationId: string,
  id: string,
  context: AgentContext,
): Promise<ProposalRow | null> {
  return context.env.DB.prepare(
    `SELECT id, conversation_id, tool_name, args_json, preview_json, status, result_json, created_at, expires_at, decided_at
     FROM agent_proposals WHERE id = ? AND conversation_id = ?`,
  )
    .bind(id, conversationId)
    .first<ProposalRow>();
}

const FEEDBACK_STATUS_LABELS: Readonly<
  Record<string, { en: string; fr: string }>
> = {
  submitted: { en: "submitted", fr: "reçu" },
  acknowledged: { en: "acknowledged", fr: "accusé de réception envoyé" },
  in_review: { en: "in review", fr: "en cours d'examen" },
  waiting_on_resident: {
    en: "waiting for resident details",
    fr: "en attente de précisions",
  },
  outcome_recorded: { en: "outcome recorded", fr: "résultat consigné" },
  closed: { en: "closed", fr: "fermé" },
  reopened: { en: "reopened", fr: "rouvert" },
};

function feedbackDuplicateStatus(result: unknown): string | null | undefined {
  if (!result || typeof result !== "object") return undefined;
  const payload = result as { data?: unknown };
  if (!payload.data || typeof payload.data !== "object") return undefined;
  const data = payload.data as { duplicate?: unknown };
  if (!Object.hasOwn(data, "duplicate")) return undefined;
  if (data.duplicate === null) return null;
  if (!data.duplicate || typeof data.duplicate !== "object") return undefined;
  const status = (data.duplicate as { status?: unknown }).status;
  return typeof status === "string" && FEEDBACK_STATUS_LABELS[status]
    ? status
    : undefined;
}

function duplicateMessage(status: string, locale: "en" | "fr"): string {
  const label = FEEDBACK_STATUS_LABELS[status]?.[locale] ?? status;
  return locale === "fr"
    ? `Un signalement semblable existe déjà dans Envoy pour cette municipalité. Son état actuel est ${label}. S'agit-il d'un problème distinct ou récurrent?`
    : `A matching report already exists in Envoy for this municipality. Its current status is ${label}. Is yours a separate issue or a recurrence?`;
}

function isSeparateIssueConfirmation(message: string): boolean {
  return (
    /^(?:yes|yeah|yep|oui|exactly|correct)[.! ]*$/i.test(message) ||
    /\b(separate|different|new occurrence|happened again|recurred|recurrence|distinct|différent|différente|nouvel incident|encore une fois|récurrent|récurrence)\b/i.test(
      message,
    )
  );
}

function duplicateResult(status: string): { status: 200; data: unknown } {
  return {
    status: 200,
    data: {
      apiVersion: API_VERSION,
      result: "duplicate",
      created: false,
      duplicate: { status },
    },
  };
}

async function checkFeedbackDuplicate(
  request: Request,
  args: ToolArguments,
  conversation: ConversationRow,
  context: AgentContext,
): Promise<string | null | Response> {
  const result = await executeTool(
    request,
    context,
    prepareTool(
      "check_feedback_duplicate",
      {
        message: args.message,
        municipalityId: args.municipalityId,
        category: args.category,
      },
      conversation.mode,
      conversation.organization_id,
    ),
  );
  const duplicate = feedbackDuplicateStatus(result);
  if (result.status !== 200 || duplicate === undefined)
    return featureError(
      context,
      "DUPLICATE_CHECK_UNAVAILABLE",
      "Matching reports could not be checked. Try again before submitting.",
      503,
    );
  return duplicate;
}

async function noteDuplicateOnProposal(
  proposal: ProposalRow,
  preview: Record<string, unknown>,
  status: string,
  context: AgentContext,
): Promise<Record<string, unknown>> {
  const updated = {
    ...preview,
    requiresDuplicateOverride: true,
    duplicateStatus: status,
  };
  await context.env.DB.prepare(
    `UPDATE agent_proposals SET preview_json = ?
     WHERE id = ? AND conversation_id = ? AND status = 'pending'`,
  )
    .bind(JSON.stringify(updated), proposal.id, proposal.conversation_id)
    .run();
  return updated;
}

function pendingDuplicateResponse(
  context: AgentContext,
  proposalId: string,
  preview: Record<string, unknown>,
  status: string,
): Response {
  return featureJson(context, {
    apiVersion: API_VERSION,
    proposal: { id: proposalId, status: "pending", preview },
    result: duplicateResult(status),
  });
}

const VERSION_READ_TOOL: Readonly<Record<string, string>> = {
  staff_change_feedback_status: "read_staff_feedback",
  staff_reply_feedback: "read_staff_feedback",
  staff_assign_feedback: "read_staff_feedback",
  staff_request_feedback_details: "read_staff_feedback",
  staff_record_feedback_outcome: "read_staff_feedback",
  review_feedback_theme_membership: "read_feedback_theme",
  staff_change_application_status: "read_staff_application",
  send_staff_application_message: "read_staff_application",
  record_application_decision: "read_staff_application",
  edit_organization_posting: "read_organization_posting",
  publish_organization_posting: "read_organization_posting",
  close_organization_posting: "read_organization_posting",
  edit_organization_program: "read_organization_program",
  publish_organization_program: "read_organization_program",
  close_organization_program: "read_organization_program",
  change_program_application_status: "read_staff_program_application",
  send_staff_program_application_message: "read_staff_program_application",
  send_program_application_message: "read_my_program_application",
  submit_program_application: "read_program",
  send_application_message: "read_my_application",
  update_profile: "read_profile",
  delete_profile: "read_profile",
  save_reusable_answer: "list_reusable_answers",
  delete_reusable_answer: "list_reusable_answers",
  delete_resume: "list_resumes",
  save_discovery_item: "list_saved_discovery",
  remove_saved_discovery_item: "list_saved_discovery",
  save_external_preparation: "read_external_preparation",
  delete_external_preparation: "read_external_preparation",
  reply_feedback: "read_feedback_receipt",
  reopen_feedback: "read_feedback_receipt",
  share_resume: "read_my_application",
  edit_taxonomy_draft: "read_taxonomy",
  publish_taxonomy_draft: "read_taxonomy",
  create_taxonomy_draft: "read_taxonomy",
  correct_classification: "read_classification",
  edit_saved_view: "read_saved_view",
  delete_saved_view: "read_saved_view",
  edit_saved_report: "read_saved_report",
  delete_saved_report: "read_saved_report",
  set_staff_default_view: "read_staff_settings",
  set_organization_reporting_window: "read_staff_settings",
  propose_source_correction: "read_curator_source",
  decide_source_correction: "read_curator_source_change",
};

async function recordVersion(
  request: Request,
  name: string,
  args: ToolArguments,
  conversation: ConversationRow,
  context: AgentContext,
): Promise<{ recordVersion?: string; changes?: ProposalChange[] }> {
  const readName = VERSION_READ_TOOL[name];
  if (!readName) {
    const prepared = prepareTool(
      name,
      args,
      conversation.mode,
      conversation.organization_id,
    );
    const changes = proposalChanges(name, args, prepared.preview.body, null);
    return changes.length > 0 ? { changes } : {};
  }
  const readArgs =
    name === "share_resume"
      ? { id: args.applicationId }
      : name === "submit_program_application"
        ? { id: args.programId }
        : args;
  const prepared = prepareTool(
    readName,
    readArgs,
    conversation.mode,
    conversation.organization_id,
  );
  const result = await executeTool(
    request,
    context,
    prepared,
    request.headers.get("X-Receipt-Token") ?? undefined,
  );
  if (result.status >= 400 || !result.data || typeof result.data !== "object")
    return {};
  const data = result.data as {
    submission?: { updatedAt?: unknown };
    application?: { updatedAt?: unknown };
    posting?: { updatedAt?: unknown };
    program?: { updatedAt?: unknown };
    theme?: { updatedAt?: unknown };
    sources?: Array<{ id?: unknown }>;
    updatedAt?: unknown;
    items?: Array<{ item?: { id?: unknown }; updatedAt?: unknown }>;
    draft?: unknown;
    classification?: { id?: unknown };
    view?: { version?: unknown };
    report?: { version?: unknown };
    settings?: { personalVersion?: unknown; organizationVersion?: unknown };
    source?: { version?: unknown };
    change?: { version?: unknown };
  };
  const proposed = prepareTool(
    name,
    args,
    conversation.mode,
    conversation.organization_id,
  );
  let comparisonData: typeof data = data;
  if (name === "decide_source_correction" && args.decision === "approve") {
    const sourceResult = await executeTool(
      request,
      context,
      prepareTool(
        "read_curator_source",
        { id: args.id },
        conversation.mode,
        conversation.organization_id,
      ),
    );
    const source =
      sourceResult.data && typeof sourceResult.data === "object"
        ? (sourceResult.data as { source?: { version?: unknown } }).source
        : undefined;
    if (sourceResult.status < 400 && source)
      comparisonData = {
        ...data,
        source,
      };
  }
  const changes = proposalChanges(
    name,
    args,
    proposed.preview.body,
    comparisonData,
  );
  const review = changes.length > 0 ? { changes } : {};
  if (
    readName === "read_curator_source" ||
    readName === "read_curator_source_change"
  ) {
    const version = (
      readName === "read_curator_source" ? data.source : data.change
    )?.version;
    return typeof version === "number"
      ? { recordVersion: String(version), ...review }
      : review;
  }
  if (readName === "read_saved_view" || readName === "read_saved_report") {
    const version = (readName === "read_saved_view" ? data.view : data.report)
      ?.version;
    return typeof version === "number"
      ? { recordVersion: String(version), ...review }
      : review;
  }
  if (readName === "read_staff_settings") {
    const version =
      name === "set_staff_default_view"
        ? data.settings?.personalVersion
        : data.settings?.organizationVersion;
    return typeof version === "number"
      ? { recordVersion: String(version), ...review }
      : review;
  }
  if (readName === "read_taxonomy" && data.draft)
    return {
      recordVersion: await sha256Hex(JSON.stringify(data.draft)),
      ...review,
    };
  if (
    readName === "read_classification" &&
    typeof data.classification?.id === "string"
  )
    return { recordVersion: data.classification.id, ...review };
  if (readName === "read_feedback_theme" && data.theme)
    return {
      recordVersion: await sha256Hex(
        JSON.stringify({
          theme: data.theme,
          sourceIds: data.sources?.map((source) => source.id) ?? [],
        }),
      ),
      ...review,
    };
  if (readName === "read_profile")
    return {
      recordVersion:
        typeof data.updatedAt === "string" ? data.updatedAt : "profile:absent",
      ...review,
    };
  if (readName === "read_external_preparation")
    return {
      recordVersion:
        typeof data.updatedAt === "string"
          ? data.updatedAt
          : "preparation:absent",
      ...review,
    };
  if (readName === "list_saved_discovery") {
    const saved = data.items?.find((entry) => entry.item?.id === args.id);
    return {
      recordVersion:
        typeof saved?.updatedAt === "string" ? saved.updatedAt : "saved:absent",
      ...review,
    };
  }
  const version = (
    data.submission ??
    data.application ??
    data.posting ??
    data.program ??
    data.theme
  )?.updatedAt;
  return typeof version === "string"
    ? { recordVersion: version, ...review }
    : review;
}

async function storeMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  context: AgentContext,
): Promise<void> {
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO agent_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`,
    ).bind(`msg_${randomHex(16)}`, conversationId, role, content, now),
    context.env.DB.prepare(
      "UPDATE agent_conversations SET updated_at = ? WHERE id = ?",
    ).bind(now, conversationId),
  ]);
}

async function reserveAiCall(context: AgentContext): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const result = await context.env.DB.prepare(
    `INSERT INTO agent_ai_daily_usage (usage_day, inference_count) VALUES (?, 1)
     ON CONFLICT(usage_day) DO UPDATE SET inference_count = inference_count + 1
     WHERE inference_count < ?`,
  )
    .bind(day, DAILY_INFERENCE_CAP)
    .run();
  return result.meta.changes === 1;
}

function isEmployee(
  actor: AuthenticatedActor | null,
): actor is AuthenticatedActor {
  return (
    !!actor &&
    (canPerformGlobalAction(actor, "taxonomy:manage") ||
      canPerformGlobalAction(actor, "source:manage") ||
      (!!actor.organizationId &&
        (canPerformOrganizationAction(
          actor,
          "feedback:read_organization",
          actor.organizationId,
        ) ||
          canPerformOrganizationAction(
            actor,
            "application:read_organization",
            actor.organizationId,
          ))))
  );
}

function conversationSummary(row: ConversationRow) {
  return {
    id: row.id,
    mode: row.mode,
    locale: row.locale,
    organizationId: row.organization_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function messageView(row: MessageRow) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    toolName: row.tool_name,
    createdAt: row.created_at,
  };
}

function proposalView(row: ProposalRow) {
  return {
    id: row.id,
    status: row.status,
    preview: JSON.parse(row.preview_json) as unknown,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    decidedAt: row.decided_at,
  };
}

function systemPrompt(conversation: ConversationRow): string {
  const tools = visibleTools(conversation.mode, conversation.organization_id)
    .map((tool) => `${tool.name} (${tool.access}): ${tool.description}`)
    .join("\n");
  return `You are Envoy's ${conversation.mode} assistant. Reply in ${conversation.locale === "fr" ? "French" : "English"} with at most two short, natural sentences. No emoji. Never invent URLs, menu names, click paths, official processes, source records, eligibility, locations, case status, or tool results. Do not claim an external application or report was submitted. Envoy is unaffiliated with government; the action preview discloses the queue destination. Do not include practice records unless the person asks for them, and disclose their status when recommending one. Never ask for or print access tokens. Direct emergencies to 911. Offer to prepare feedback when a resident describes an unresolved service problem. Before proposing feedback, check for a matching report; if found, say its status and only offer a separate report when the resident confirms a distinct issue or recurrence. Do not execute writes without the approval card. Employee tools access only the current role and organization. Describe your capabilities in natural language, never as raw tool identifiers. Your role's capabilities: ${capabilityAnswer(conversation.mode, conversation.locale, conversation.organization_id)} For specific jobs, services, funding, or support queries use filtered search_discovery, not the full list_source_records catalogue. Use list_source_records only when the person explicitly requests the source catalogue.\nAvailable tools:\n${tools}\nRespond as compact JSON: {"message":"plain answer","tool":{"name":"one exact tool name","args":{}}}. Omit tool if none is needed. Use at most one tool per turn. Ask for missing details. For write tools, the server creates a proposal card.`;
}

function parseInstruction(raw: string | undefined): {
  message: string;
  tool?: { name: string; args: ToolArguments };
} {
  const text =
    raw?.trim() || "I can help you with this. What would you like to do?";
  const candidate = text.startsWith("```")
    ? text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : text;
  try {
    const parsed = JSON.parse(candidate) as ModelInstruction;
    const message =
      typeof parsed.message === "string" && parsed.message.trim()
        ? parsed.message.trim()
        : "I can help with that.";
    if (typeof parsed.tool?.name === "string" && isArguments(parsed.tool.args))
      return {
        message,
        tool: { name: parsed.tool.name, args: parsed.tool.args },
      };
    return { message };
  } catch {
    return { message: text };
  }
}

function modelText(response: AiGeneration): string | undefined {
  if (typeof response.response === "string") return response.response;
  const content = response.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : undefined;
}

function appearsEmergency(message: string): boolean {
  return /\b(emergency|immediate danger|someone is injured|medical emergency|fire|911|urgence|danger immédiat|blessé|incendie)\b/i.test(
    message,
  );
}

function suggestsServiceIssue(message: string): boolean {
  return /\b(broken|damaged|unsafe|complaint|not working|service failed|pothole|missed garbage|water outage|noise complaint|streetlight|défectueux|endommagé|endommagée|problème|plainte|service en panne)\b/i.test(
    message,
  );
}

function requestsFeedbackPreparation(message: string): boolean {
  if (
    /\b(?:do not|don't|never|ne pas)\s+(?:prepare|draft|create|make|show|start|open|call|préparer|créer)\b/i.test(
      message,
    )
  )
    return false;
  return (
    /\b(?:prepare|draft|create|make|show|start|open|call|préparer|créer|montre|rédiger)\b/i.test(
      message,
    ) &&
    /\b(?:feedback|complaint|report|proposal|preview|signalement|plainte|aperçu|brouillon)\b/i.test(
      message,
    )
  );
}

function claimsUnverifiedAction(message: string): boolean {
  return /\b(?:i(?:'ve| have)?(?: now| just)?\s+(?:prepared|created|drafted|called|submitted|sent|filed|published|updated|closed|uploaded|attached)|(?:proposal card|action preview|feedback preview|report draft)\s+(?:is|has been)\s+(?:ready|displayed|prepared|created)|(?:here(?:'s| is)|below is)\s+(?:the|your|a)\s+(?:feedback\s+)?(?:report\s+)?(?:preview|draft|proposal)|(?:j['’]ai|je viens de)\s+(?:préparé|créé|rédigé|envoyé|soumis)|(?:aperçu|brouillon)\s+(?:est|a été)\s+(?:prêt|préparé|créé))/i.test(
    message,
  );
}

function redactSecrets(message: string): string {
  return message
    .replace(/\b[a-f0-9]{64}\b/gi, "[private token removed]")
    .replace(/\bBearer\s+[^\s]+/gi, "[access token removed]");
}

function isArguments(value: unknown): value is ToolArguments {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function allowedToolMentions(
  value: unknown,
  conversation: ConversationRow,
): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 3) return null;
  const allowed = new Set(
    visibleTools(conversation.mode, conversation.organization_id).map(
      (tool) => tool.name,
    ),
  );
  if (value.some((name) => typeof name !== "string" || !allowed.has(name)))
    return null;
  return [...new Set(value as string[])];
}

function proposalArguments(name: string, args: ToolArguments): ToolArguments {
  if (name !== "create_feedback") return args;
  const safe = { ...args };
  delete safe.feedbackEvidenceAssetIds;
  return safe;
}

function proposalEvidenceIds(args: ToolArguments): string[] | null {
  const value = args.feedbackEvidenceAssetIds;
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > 3 ||
    value.some(
      (item) => typeof item !== "string" || !/^asset_[a-f0-9]{32}$/.test(item),
    ) ||
    new Set(value).size !== value.length
  )
    return null;
  return value as string[];
}

function randomHex(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function deterministicReceiptToken(
  secret: string,
  proposalId: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`agent-feedback:${proposalId}`),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function stripReceiptToken(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { receiptToken: _receiptToken, ...safe } = value as Record<
    string,
    unknown
  >;
  return safe;
}

async function jsonBody(request: Request): Promise<AgentRequestBody | null> {
  return (await request.json().catch(() => null)) as AgentRequestBody | null;
}
