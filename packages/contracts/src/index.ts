import { z } from "zod";

export const statusSchema = z.enum([
  "submitted",
  "classified",
  "needs_review",
  "assigned",
  "acknowledged",
  "in_progress",
  "waiting_on_resident",
  "resolved",
  "reopened",
  "closed",
]);
export type CaseStatus = z.infer<typeof statusSchema>;

export const roleSchema = z.enum([
  "resident",
  "reviewer",
  "department_admin",
  "organization_owner",
]);
export type Role = z.infer<typeof roleSchema>;

export const submitCaseSchema = z.object({
  description: z.string().trim().min(15).max(4000),
  location: z.string().trim().min(3).max(300),
  contactEmail: z.email().optional(),
});
export type SubmitCase = z.infer<typeof submitCaseSchema>;

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  examples: z.array(z.string()),
  exclusions: z.array(z.string()),
  requiredFields: z.array(z.string()),
  routingTeam: z.string().min(1),
  publicExplanation: z.string(),
  version: z.number().int().positive(),
  status: z.enum(["draft", "published", "archived"]),
});
export type Category = z.infer<typeof categorySchema>;

export const classificationSchema = z.object({
  categoryId: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  provider: z.string(),
  taxonomyVersion: z.number().int().positive(),
});
export type Classification = z.infer<typeof classificationSchema>;

export const transitionSchema = z.object({
  status: statusSchema,
  note: z.string().trim().max(2000).optional(),
  expectedVersion: z.number().int().positive(),
});

export type CaseRecord = {
  id: string;
  description: string;
  location: string;
  contactEmail?: string;
  status: CaseStatus;
  categoryId: string | null;
  department: string | null;
  confidence: number | null;
  taxonomyVersion: number;
  version: number;
  ownerSubject: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CaseEvent = {
  id: string;
  caseId: string;
  eventType: string;
  occurredAt: string;
  actorType: "resident" | "admin" | "system";
  actorId: string | null;
  payload: Record<string, unknown>;
};
