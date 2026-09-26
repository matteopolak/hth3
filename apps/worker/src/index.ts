import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  classifyWithFallback,
  FixtureClassificationProvider,
  JevClassificationProvider,
  WorkersAIClassificationProvider,
  type WorkersAIBinding,
} from "@civicresolve/ai";
import {
  categorySchema,
  submitCaseSchema,
  transitionSchema,
  type CaseRecord,
  type Role,
} from "@civicresolve/contracts";
import {
  canManageCases,
  canPublishTaxonomy,
  canTransition,
  fixtureClassify,
  requiresReview,
} from "@civicresolve/domain";
import { taxonomy as initialTaxonomy } from "@civicresolve/fixtures";
import { parseVoiceReport, verifyElevenLabsSignature } from "./voice";

interface Env {
  DB: D1Database;
  DEMO_MODE?: string;
  AUTH0_DOMAIN?: string;
  AUTH0_AUDIENCE?: string;
  WEB_ORIGIN?: string;
  JEV_API_KEY?: string;
  AI?: WorkersAIBinding;
  ELEVENLABS_WEBHOOK_SECRET?: string;
  ELEVENLABS_AGENT_ID?: string;
}

type Principal = {
  sub: string;
  role: Role;
  scope: string[];
  steppedUp: boolean;
  department: string | null;
};
type CaseRow = {
  id: string;
  description: string;
  location: string;
  contact_email: string | null;
  status: CaseRecord["status"];
  category_id: string | null;
  department: string | null;
  confidence: number | null;
  taxonomy_version: number;
  version: number;
  owner_subject: string | null;
  status_token_hash: string;
  created_at: string;
  updated_at: string;
};

const json = (value: unknown, status = 200) => Response.json(value, { status });
const error = (message: string, status: number) =>
  json({ error: message }, status);

async function hash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}

function publicCase(row: CaseRow): CaseRecord {
  return {
    id: row.id,
    description: row.description,
    location: row.location,
    contactEmail: row.contact_email ?? undefined,
    status: row.status,
    categoryId: row.category_id,
    department: row.department,
    confidence: row.confidence,
    taxonomyVersion: row.taxonomy_version,
    version: row.version,
    ownerSubject: row.owner_subject,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function principal(
  request: Request,
  env: Env,
): Promise<Principal | null> {
  if (env.DEMO_MODE === "true" && request.headers.get("X-Demo-Role")) {
    const role = request.headers.get("X-Demo-Role") as Role;
    if (
      [
        "resident",
        "reviewer",
        "department_admin",
        "organization_owner",
      ].includes(role)
    ) {
      return {
        sub: `demo:${role}`,
        role,
        scope: ["cases:read", "cases:write", "taxonomy:publish"],
        steppedUp: true,
        department: null,
      };
    }
  }
  const bearer = request.headers.get("Authorization")?.match(/^Bearer (.+)$/);
  if (!bearer || !env.AUTH0_DOMAIN || !env.AUTH0_AUDIENCE) return null;
  const issuer = `https://${env.AUTH0_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "")}/`;
  try {
    const { payload } = await jwtVerify(
      bearer[1],
      createRemoteJWKSet(new URL(".well-known/jwks.json", issuer)),
      {
        issuer,
        audience: env.AUTH0_AUDIENCE,
        algorithms: ["RS256"],
      },
    );
    const permissions = Array.isArray(payload.permissions)
      ? payload.permissions.filter((x): x is string => typeof x === "string")
      : [];
    const role: Role = permissions.includes("taxonomy:publish")
      ? "organization_owner"
      : permissions.includes("cases:manage")
        ? "department_admin"
        : permissions.includes("cases:review")
          ? "reviewer"
          : "resident";
    const amr = Array.isArray(payload.amr) ? payload.amr : [];
    const authTime =
      typeof payload.auth_time === "number" ? payload.auth_time : 0;
    return {
      sub: payload.sub ?? "",
      role,
      scope: permissions,
      steppedUp: amr.includes("mfa") && Date.now() / 1000 - authTime < 300,
      department:
        typeof payload["https://civicresolve.org/department"] === "string"
          ? (payload["https://civicresolve.org/department"] as string)
          : null,
    };
  } catch {
    return null;
  }
}

async function activeTaxonomy(db: D1Database) {
  const result = await db
    .prepare("SELECT MAX(version) AS version FROM taxonomy_versions")
    .first<{ version: number | null }>();
  if (!result?.version) return initialTaxonomy;
  const rows = await db
    .prepare("SELECT * FROM categories WHERE version = ?")
    .bind(result.version)
    .all<Record<string, unknown>>();
  return rows.results.map((row) =>
    categorySchema.parse({
      id: row.id,
      name: row.name,
      description: row.description,
      routingTeam: row.routing_team,
      publicExplanation: row.public_explanation,
      version: row.version,
      status: row.status,
      examples: JSON.parse(String(row.examples)),
      exclusions: JSON.parse(String(row.exclusions)),
      requiredFields: JSON.parse(String(row.required_fields)),
    }),
  );
}

async function getCase(db: D1Database, id: string) {
  return db
    .prepare("SELECT * FROM cases WHERE id = ?")
    .bind(id)
    .first<CaseRow>();
}

async function allowedCase(
  request: Request,
  env: Env,
  row: CaseRow,
): Promise<boolean> {
  const token = request.headers.get("X-Case-Token");
  if (token && (await hash(token)) === row.status_token_hash) return true;
  const user = await principal(request, env);
  return (
    !!user &&
    (user.sub === row.owner_subject ||
      user.role === "organization_owner" ||
      (user.role === "reviewer" && row.status === "needs_review") ||
      (user.role === "department_admin" &&
        !!user.department &&
        row.department === user.department))
  );
}

async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/api/health")
    return json({
      ok: true,
      mode: env.DEMO_MODE === "true" ? "demo/offline" : "live",
    });
  if (path === "/api/taxonomy" && request.method === "GET")
    return json({ categories: await activeTaxonomy(env.DB) });

  if (
    path === "/api/integrations/elevenlabs/webhook" &&
    request.method === "POST"
  ) {
    if (!env.ELEVENLABS_WEBHOOK_SECRET || !env.ELEVENLABS_AGENT_ID)
      return error("Voice integration unavailable", 503);
    const rawBody = await request.text();
    if (rawBody.length > 262_144) return error("Webhook too large", 413);
    if (
      !(await verifyElevenLabsSignature(
        rawBody,
        request.headers.get("ElevenLabs-Signature"),
        env.ELEVENLABS_WEBHOOK_SECRET,
      ))
    )
      return error("Invalid webhook signature", 401);
    let report;
    try {
      report = parseVoiceReport(rawBody);
    } catch {
      return error("Invalid webhook payload", 400);
    }
    if (report.type === "ignored") return json({ status: "ignored" });
    if (report.type === "incomplete")
      return json({
        status: "incomplete",
        conversationId: report.conversationId,
      });
    if (report.agentId !== env.ELEVENLABS_AGENT_ID)
      return error("Unexpected voice agent", 403);
    const reserved = await env.DB.prepare(
      "INSERT OR IGNORE INTO voice_sessions (conversation_id,agent_id,case_id,transcript,created_at) VALUES (?,?,NULL,?,?)",
    )
      .bind(
        report.conversationId,
        report.agentId,
        JSON.stringify(report.transcript),
        new Date().toISOString(),
      )
      .run();
    if (reserved.meta.changes !== 1) {
      const prior = await env.DB.prepare(
        "SELECT case_id FROM voice_sessions WHERE conversation_id=?",
      )
        .bind(report.conversationId)
        .first<{ case_id: string | null }>();
      return json({
        status: prior?.case_id ? "duplicate" : "processing",
        caseId: prior?.case_id ?? null,
      });
    }
    let created: Response;
    try {
      created = await handle(
        new Request(new URL("/api/cases", request.url), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(report.intake),
        }),
        env,
      );
    } catch {
      await env.DB.prepare(
        "DELETE FROM voice_sessions WHERE conversation_id=? AND case_id IS NULL",
      )
        .bind(report.conversationId)
        .run();
      return error("Voice case creation failed", 503);
    }
    if (!created.ok) {
      await env.DB.prepare(
        "DELETE FROM voice_sessions WHERE conversation_id=? AND case_id IS NULL",
      )
        .bind(report.conversationId)
        .run();
      return error("Voice case creation failed", 503);
    }
    const result = (await created.json()) as { case: CaseRecord };
    await env.DB.prepare(
      "UPDATE voice_sessions SET case_id=? WHERE conversation_id=?",
    )
      .bind(result.case.id, report.conversationId)
      .run();
    return json({ status: "created", caseId: result.case.id });
  }

  if (path === "/api/cases" && request.method === "POST") {
    const input = submitCaseSchema.safeParse(await request.json());
    if (!input.success)
      return error("Check the description and location.", 400);
    const categories = await activeTaxonomy(env.DB);
    const classifyInput = {
      text: input.data.description,
      taxonomy: categories,
      extractedFields: { location: input.data.location },
    };
    let decision;
    if (env.DEMO_MODE === "true") {
      decision = await new FixtureClassificationProvider().classify(
        classifyInput,
      );
    } else {
      if (!env.JEV_API_KEY && !env.AI)
        return error("Classification service unavailable", 503);
      try {
        decision = await classifyWithFallback(
          classifyInput,
          env.JEV_API_KEY
            ? new JevClassificationProvider(env.JEV_API_KEY)
            : null,
          env.AI ? new WorkersAIClassificationProvider(env.AI) : null,
        );
      } catch {
        return error("Classification service unavailable", 503);
      }
    }
    const category = categories.find(
      (item) => item.id === decision.categoryId,
    )!;
    const review = requiresReview(decision);
    const id = `CR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const token = crypto.randomUUID() + crypto.randomUUID();
    const now = new Date().toISOString();
    const user = await principal(request, env);
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO cases (id,description,location,contact_email,status,category_id,department,confidence,taxonomy_version,version,owner_subject,status_token_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?,?)",
      ).bind(
        id,
        input.data.description,
        input.data.location,
        input.data.contactEmail ?? null,
        review ? "needs_review" : "assigned",
        category.id,
        review ? null : category.routingTeam,
        decision.confidence,
        decision.taxonomyVersion,
        user?.sub ?? null,
        await hash(token),
        now,
        now,
      ),
      env.DB.prepare("INSERT INTO case_events VALUES (?,?,?,?,?,?,?)").bind(
        crypto.randomUUID(),
        id,
        "submitted",
        now,
        "resident",
        user?.sub ?? null,
        JSON.stringify({ location: input.data.location }),
      ),
      env.DB.prepare("INSERT INTO case_events VALUES (?,?,?,?,?,?,?)").bind(
        crypto.randomUUID(),
        id,
        review ? "needs_review" : "assigned",
        now,
        "system",
        null,
        JSON.stringify({
          categoryId: category.id,
          confidence: decision.confidence,
          provider: decision.provider,
          taxonomyVersion: decision.taxonomyVersion,
        }),
      ),
    ]);
    return json(
      {
        case: publicCase((await getCase(env.DB, id))!),
        statusToken: token,
        explanation: review
          ? "A staff member will review your report before assignment."
          : category.publicExplanation,
        mode: decision.provider,
      },
      201,
    );
  }

  const caseMatch = path.match(/^\/api\/cases\/([^/]+)(?:\/(events))?$/);
  if (caseMatch && request.method === "GET") {
    const row = await getCase(env.DB, caseMatch[1]);
    if (!row) return error("Case not found", 404);
    if (!(await allowedCase(request, env, row)))
      return error("Access denied", 403);
    if (caseMatch[2] === "events") {
      const rows = await env.DB.prepare(
        "SELECT * FROM case_events WHERE case_id = ? ORDER BY occurred_at, id",
      )
        .bind(row.id)
        .all<Record<string, unknown>>();
      return json({
        events: rows.results.map((event) => ({
          ...event,
          payload: JSON.parse(String(event.payload)),
        })),
      });
    }
    return json({ case: publicCase(row) });
  }

  if (path === "/api/admin/cases" && request.method === "GET") {
    const user = await principal(request, env);
    if (!user || !canManageCases(user.role))
      return error("Admin access required", 403);
    if (user.role === "department_admin" && !user.department)
      return error("Department claim required", 403);
    const query =
      user.role === "reviewer"
        ? env.DB.prepare(
            "SELECT * FROM cases WHERE status='needs_review' ORDER BY created_at DESC LIMIT 100",
          )
        : user.role === "department_admin"
          ? env.DB.prepare(
              "SELECT * FROM cases WHERE department=? ORDER BY created_at DESC LIMIT 100",
            ).bind(user.department)
          : env.DB.prepare(
              "SELECT * FROM cases ORDER BY created_at DESC LIMIT 100",
            );
    const rows = await query.all<CaseRow>();
    return json({ cases: rows.results.map(publicCase) });
  }

  const detailMatch = path.match(/^\/api\/admin\/cases\/([^/]+)$/);
  if (detailMatch && request.method === "GET") {
    const user = await principal(request, env);
    if (!user || !canManageCases(user.role))
      return error("Admin access required", 403);
    const row = await getCase(env.DB, detailMatch[1]);
    if (!row) return error("Case not found", 404);
    if (!(await allowedCase(request, env, row)))
      return error("Case access denied", 403);
    const events = await env.DB.prepare(
      "SELECT * FROM case_events WHERE case_id=? ORDER BY occurred_at, id",
    )
      .bind(row.id)
      .all<Record<string, unknown>>();
    const voice = await env.DB.prepare(
      "SELECT conversation_id, transcript FROM voice_sessions WHERE case_id=?",
    )
      .bind(row.id)
      .first<{ conversation_id: string; transcript: string }>();
    return json({
      case: publicCase(row),
      events: events.results.map((event) => ({
        ...event,
        payload: JSON.parse(String(event.payload)),
      })),
      voice: voice
        ? {
            conversationId: voice.conversation_id,
            transcript: JSON.parse(voice.transcript),
          }
        : null,
    });
  }

  const transitionMatch = path.match(
    /^\/api\/admin\/cases\/([^/]+)\/transition$/,
  );
  if (transitionMatch && request.method === "POST") {
    const user = await principal(request, env);
    if (!user || !canManageCases(user.role))
      return error("Admin access required", 403);
    const row = await getCase(env.DB, transitionMatch[1]);
    if (!row) return error("Case not found", 404);
    if (user.role === "reviewer" && row.status !== "needs_review")
      return error("Reviewer scope exceeded", 403);
    if (
      user.role === "department_admin" &&
      (!user.department || row.department !== user.department)
    )
      return error("Department scope exceeded", 403);
    const input = transitionSchema.safeParse(await request.json());
    if (!input.success) return error("Invalid transition", 400);
    if (row.version !== input.data.expectedVersion)
      return error("Case changed. Refresh and retry.", 409);
    if (!canTransition(row.status, input.data.status))
      return error("Transition not allowed", 409);
    const categories = await activeTaxonomy(env.DB);
    const category = categories.find((item) => item.id === row.category_id);
    const department =
      input.data.status === "assigned"
        ? (category?.routingTeam ?? row.department)
        : row.department;
    const now = new Date().toISOString();
    const changed = await env.DB.prepare(
      "UPDATE cases SET status=?, department=?, version=version+1, updated_at=? WHERE id=? AND version=?",
    )
      .bind(input.data.status, department, now, row.id, row.version)
      .run();
    if (changed.meta.changes !== 1)
      return error("Case changed. Refresh and retry.", 409);
    await env.DB.prepare("INSERT INTO case_events VALUES (?,?,?,?,?,?,?)")
      .bind(
        crypto.randomUUID(),
        row.id,
        input.data.status,
        now,
        "admin",
        user.sub,
        JSON.stringify({ from: row.status, note: input.data.note ?? "" }),
      )
      .run();
    return json({ case: publicCase((await getCase(env.DB, row.id))!) });
  }

  if (path === "/api/admin/taxonomy" && request.method === "GET") {
    const user = await principal(request, env);
    if (!user || !canManageCases(user.role))
      return error("Admin access required", 403);
    return json({ categories: await activeTaxonomy(env.DB) });
  }

  if (path === "/api/admin/taxonomy/drafts" && request.method === "POST") {
    const user = await principal(request, env);
    if (!user || !canPublishTaxonomy(user.role))
      return error("Owner access required", 403);
    const input = categorySchema
      .omit({ id: true, version: true, status: true })
      .safeParse(await request.json());
    if (!input.success) return error("Invalid category", 400);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO taxonomy_drafts (id,name,description,routing_team,public_explanation,created_by,created_at,examples,exclusions,required_fields) VALUES (?,?,?,?,?,?,?,?,?,?)",
    )
      .bind(
        id,
        input.data.name,
        input.data.description,
        input.data.routingTeam,
        input.data.publicExplanation,
        user.sub,
        new Date().toISOString(),
        JSON.stringify(input.data.examples),
        JSON.stringify(input.data.exclusions),
        JSON.stringify(input.data.requiredFields),
      )
      .run();
    return json({ id, ...input.data, status: "draft" }, 201);
  }

  if (path === "/api/admin/taxonomy/simulate" && request.method === "POST") {
    const user = await principal(request, env);
    if (!user || !canPublishTaxonomy(user.role))
      return error("Owner access required", 403);
    const body = (await request.json()) as { draftId?: string };
    if (!body.draftId) return error("Draft required", 400);
    const draft = await env.DB.prepare(
      "SELECT * FROM taxonomy_drafts WHERE id=?",
    )
      .bind(body.draftId)
      .first<Record<string, string>>();
    if (!draft) return error("Draft not found", 404);
    const current = await activeTaxonomy(env.DB);
    const version = current[0].version + 1;
    const candidate = categorySchema.parse({
      id: draft.id,
      name: draft.name,
      description: draft.description,
      routingTeam: draft.routing_team,
      publicExplanation: draft.public_explanation,
      examples: JSON.parse(draft.examples),
      exclusions: JSON.parse(draft.exclusions),
      requiredFields: JSON.parse(draft.required_fields),
      version,
      status: "published",
    });
    const proposed = [
      ...current.map((item) => ({ ...item, version })),
      candidate,
    ];
    const rows = await env.DB.prepare(
      "SELECT id, description, category_id FROM cases ORDER BY created_at DESC LIMIT 500",
    ).all<{ id: string; description: string; category_id: string | null }>();
    const changed = rows.results.filter(
      (row) =>
        fixtureClassify(row.description, proposed).categoryId !==
        row.category_id,
    );
    return json({
      expectedVersion: current[0].version,
      proposedVersion: version,
      evaluatedCases: rows.results.length,
      changedCases: changed.length,
      examples: changed.slice(0, 10).map((row) => row.id),
    });
  }

  if (path === "/api/admin/taxonomy/publish" && request.method === "POST") {
    const user = await principal(request, env);
    if (!user || !canPublishTaxonomy(user.role))
      return error("Owner access required", 403);
    if (!user.steppedUp)
      return error("Recent MFA authentication required", 403);
    const body = (await request.json()) as {
      draftId?: string;
      expectedVersion?: number;
    };
    if (!body.draftId) return error("Draft required", 400);
    const draft = await env.DB.prepare(
      "SELECT * FROM taxonomy_drafts WHERE id=?",
    )
      .bind(body.draftId)
      .first<Record<string, string>>();
    if (!draft) return error("Draft not found", 404);
    const current = await activeTaxonomy(env.DB);
    if (body.expectedVersion !== current[0].version)
      return error("Taxonomy changed. Simulate again.", 409);
    const version = current[0].version + 1;
    const now = new Date().toISOString();
    const statements = [
      env.DB.prepare("INSERT INTO taxonomy_versions VALUES (?,?,?)").bind(
        version,
        now,
        user.sub,
      ),
    ];
    for (const item of current)
      statements.push(
        env.DB.prepare(
          "INSERT INTO categories (version,id,name,description,routing_team,public_explanation,status,examples,exclusions,required_fields) VALUES (?,?,?,?,?,?,?,?,?,?)",
        ).bind(
          version,
          item.id,
          item.name,
          item.description,
          item.routingTeam,
          item.publicExplanation,
          "published",
          JSON.stringify(item.examples),
          JSON.stringify(item.exclusions),
          JSON.stringify(item.requiredFields),
        ),
      );
    statements.push(
      env.DB.prepare(
        "INSERT INTO categories (version,id,name,description,routing_team,public_explanation,status,examples,exclusions,required_fields) VALUES (?,?,?,?,?,?,?,?,?,?)",
      ).bind(
        version,
        draft.id,
        draft.name,
        draft.description,
        draft.routing_team,
        draft.public_explanation,
        "published",
        draft.examples,
        draft.exclusions,
        draft.required_fields,
      ),
    );
    statements.push(
      env.DB.prepare("DELETE FROM taxonomy_drafts WHERE id=?").bind(draft.id),
    );
    statements.push(
      env.DB.prepare("INSERT INTO audit_events VALUES (?,?,?,?,?,?,?)").bind(
        crypto.randomUUID(),
        user.sub,
        user.role,
        "taxonomy.published",
        `taxonomy:${version}`,
        now,
        JSON.stringify({
          previousVersion: current[0].version,
          categoryId: draft.id,
        }),
      ),
    );
    await env.DB.batch(statements);
    return json({ version, publishedAt: now, categoryId: draft.id });
  }

  return error("Route not found", 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const allowedOrigins =
      env.DEMO_MODE === "true"
        ? ["http://localhost:5173", "http://127.0.0.1:5173"]
        : env.WEB_ORIGIN
          ? [env.WEB_ORIGIN]
          : [];
    const allowedOrigin =
      origin && allowedOrigins.includes(origin) ? origin : null;
    if (request.method === "OPTIONS")
      return new Response(null, {
        status: allowedOrigin ? 204 : 403,
        headers: {
          ...(allowedOrigin
            ? { "Access-Control-Allow-Origin": allowedOrigin }
            : {}),
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-Case-Token, X-Demo-Role",
        },
      });
    try {
      const response = await handle(request, env);
      if (allowedOrigin)
        response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
      return response;
    } catch (cause) {
      console.error(cause);
      const response = error("Unexpected server error", 500);
      if (allowedOrigin)
        response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
      return response;
    }
  },
} satisfies ExportedHandler<Env>;
