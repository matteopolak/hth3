import type { Program, ProgramApplication, ProgramMessage } from "./types.js";

const base = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787/api/v1"
).replace(/\/$/, "");

async function call<T>(
  path: string,
  token?: string | null,
  method = "GET",
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const error = payload.error as { message?: string } | undefined;
    throw new Error(error?.message ?? `Request failed (${response.status})`);
  }
  return payload as T;
}

export const programsApi = {
  list: () => call<{ programs: Program[] }>("/programs"),
  get: (id: string) =>
    call<{ program: Program }>(`/programs/${encodeURIComponent(id)}`),
  listMine: (token: string) =>
    call<{ applications: ProgramApplication[] }>(
      "/program-applications",
      token,
    ),
  submit: (
    token: string,
    body: {
      programId: string;
      answers: Record<string, string>;
      confirmedByApplicant: true;
      sandboxAcknowledged?: true;
    },
  ) =>
    call<{ application: ProgramApplication }>(
      "/program-applications",
      token,
      "POST",
      body,
      crypto.randomUUID(),
    ),
  ownApplication: (token: string, id: string) =>
    call<{ application: ProgramApplication }>(
      `/program-applications/${encodeURIComponent(id)}`,
      token,
    ),
  ownMessages: (token: string, id: string) =>
    call<{ messages: ProgramMessage[] }>(
      `/program-applications/${encodeURIComponent(id)}/messages`,
      token,
    ),
  ownMessage: (token: string, id: string, message: string) =>
    call<{ message: ProgramMessage }>(
      `/program-applications/${encodeURIComponent(id)}/messages`,
      token,
      "POST",
      { message },
    ),
  staffPrograms: (token: string, org: string) =>
    call<{ programs: Program[] }>(
      `/staff/organizations/${encodeURIComponent(org)}/programs`,
      token,
    ),
  staffCreate: (
    token: string,
    org: string,
    body: Pick<Program, "kind" | "title" | "summary" | "questions">,
  ) =>
    call<{ program: Program }>(
      `/staff/organizations/${encodeURIComponent(org)}/programs`,
      token,
      "POST",
      body,
    ),
  staffEdit: (
    token: string,
    org: string,
    id: string,
    body: Pick<Program, "kind" | "title" | "summary" | "questions">,
  ) =>
    call<{ program: Program }>(
      `/staff/organizations/${encodeURIComponent(org)}/programs/${encodeURIComponent(id)}`,
      token,
      "PATCH",
      body,
    ),
  staffState: (
    token: string,
    org: string,
    id: string,
    operation: "publish" | "close",
  ) =>
    call<{ program: Program }>(
      `/staff/organizations/${encodeURIComponent(org)}/programs/${encodeURIComponent(id)}/${operation}`,
      token,
      "POST",
    ),
  staffApplications: (token: string, org: string) =>
    call<{ applications: ProgramApplication[] }>(
      `/staff/organizations/${encodeURIComponent(org)}/program-applications`,
      token,
    ),
  staffApplication: (token: string, org: string, id: string) =>
    call<{ application: ProgramApplication }>(
      `/staff/organizations/${encodeURIComponent(org)}/program-applications/${encodeURIComponent(id)}`,
      token,
    ),
  staffStatus: (
    token: string,
    org: string,
    id: string,
    status: ProgramApplication["status"],
  ) =>
    call<{ application: ProgramApplication }>(
      `/staff/organizations/${encodeURIComponent(org)}/program-applications/${encodeURIComponent(id)}/status`,
      token,
      "PATCH",
      { status },
    ),
  staffMessages: (token: string, org: string, id: string) =>
    call<{ messages: ProgramMessage[] }>(
      `/staff/organizations/${encodeURIComponent(org)}/program-applications/${encodeURIComponent(id)}/messages`,
      token,
    ),
  staffMessage: (token: string, org: string, id: string, message: string) =>
    call<{ message: ProgramMessage }>(
      `/staff/organizations/${encodeURIComponent(org)}/program-applications/${encodeURIComponent(id)}/messages`,
      token,
      "POST",
      { message },
    ),
};
