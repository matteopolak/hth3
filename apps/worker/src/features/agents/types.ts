import type { FeatureContext } from "../shared.js";

export type AgentMode = "resident" | "employee";
export type ToolAccess = "read" | "write";
export type ToolArguments = Record<string, unknown>;

export interface AiGeneration {
  response?: string;
  tool_calls?: unknown[];
  choices?: Array<{
    message?: { content?: string | null; tool_calls?: unknown[] };
    finish_reason?: string | null;
  }>;
}

export interface AiBinding {
  run(
    model: string,
    input: {
      messages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
      }>;
      max_tokens?: number;
      temperature?: number;
      stream: true;
    },
  ): Promise<ReadableStream<Uint8Array>>;
  run(
    model: string,
    input: {
      messages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
      }>;
      max_tokens?: number;
      temperature?: number;
    },
  ): Promise<AiGeneration>;
}

export interface AgentContext extends FeatureContext {
  env: FeatureContext["env"] & { AI?: AiBinding };
}

export interface ConversationRow {
  id: string;
  mode: AgentMode;
  locale: "en" | "fr";
  owner_subject: string | null;
  guest_token_hash: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_name: string | null;
  created_at: string;
}

export interface ProposalRow {
  id: string;
  conversation_id: string;
  tool_name: string;
  args_json: string;
  preview_json: string;
  status: "pending" | "approved" | "rejected";
  result_json: string | null;
  created_at: string;
  expires_at: string;
  decided_at: string | null;
}
