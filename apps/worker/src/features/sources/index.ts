import { API_VERSION } from "@civicresolve/contracts/v1";
import { listSourceRegistry } from "@civicresolve/db/d1";
import type { FeatureContext } from "../shared.js";

const COLLECTION_PATH = "/api/v1/sources";

export interface SourceRegistryResponse {
  apiVersion: typeof API_VERSION;
  sources: Awaited<ReturnType<typeof listSourceRegistry>>;
  samplesIncluded: boolean;
  policy: {
    samplesAreFictional: true;
    externalSourcesRequireTermsReview: true;
  };
  requestId: string;
}

export async function handleSourceRequest(
  request: Request,
  url: URL,
  context: FeatureContext,
): Promise<Response | null> {
  if (url.pathname !== COLLECTION_PATH) return null;
  if (request.method !== "GET")
    return sourceError(context, "METHOD_NOT_ALLOWED", "Use GET.", 405);

  const includeSamples = url.searchParams.get("includeSamples") === "true";
  const sources = await listSourceRegistry(context.env.DB, { includeSamples });
  return sourceJson(context, {
    apiVersion: API_VERSION,
    sources,
    samplesIncluded: includeSamples,
    policy: {
      samplesAreFictional: true,
      externalSourcesRequireTermsReview: true,
    },
    requestId: context.requestId,
  } satisfies SourceRegistryResponse);
}

function sourceJson(
  context: FeatureContext,
  value: unknown,
  status = 200,
): Response {
  const headers = new Headers(context.cors);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(value), { status, headers });
}

function sourceError(
  context: FeatureContext,
  code: string,
  message: string,
  status: number,
): Response {
  return sourceJson(
    context,
    {
      apiVersion: API_VERSION,
      error: { code, message, requestId: context.requestId },
    },
    status,
  );
}
