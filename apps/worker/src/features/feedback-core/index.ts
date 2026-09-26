import { featureError } from "../shared.js";
import { handleGuestFeedback } from "./guest.js";
import { handleStaffFeedback } from "./staff.js";
import type { FeedbackContext } from "./types.js";

export async function handleFeedbackRequest(
  request: Request,
  url: URL,
  context: FeedbackContext,
): Promise<Response | null> {
  const guest = await handleGuestFeedback(request, url, context);
  if (guest) return guest;

  const staffMatch = url.pathname.match(
    /^\/api\/v1\/staff\/organizations\/([A-Za-z0-9_-]+)\/feedback(?:\/(?:(fb_[a-f0-9]{32})(?:\/(messages|status|attachments|assignment|request-details|outcome)(?:\/(asset_[a-f0-9]{32}))?)?|(assignment-options)))?$/,
  );
  if (staffMatch) return handleStaffFeedback(request, staffMatch, context);
  if (
    url.pathname.startsWith("/api/v1/staff/organizations/") &&
    url.pathname.includes("/feedback")
  ) {
    return featureError(context, "NOT_FOUND", "Feedback not found.", 404);
  }
  return null;
}
