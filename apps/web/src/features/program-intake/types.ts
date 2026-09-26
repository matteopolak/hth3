import type { Locale } from "@civicresolve/contracts/v1";
import type {
  ProgramApplicationStatus,
  ProgramQuestion,
} from "@civicresolve/domain/program-intake";

export interface Program {
  id: string;
  organizationId: string;
  sponsor: string;
  kind: "grant" | "benefit";
  title: string;
  summary: string;
  questions: ProgramQuestion[];
  status: "draft" | "published" | "closed";
  sample: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  closedAt: string | null;
}

export interface ProgramApplication {
  id: string;
  programId: string;
  programTitle: string;
  status: ProgramApplicationStatus;
  sample: boolean;
  submittedAt: string;
  updatedAt: string;
  answers: Record<string, string>;
  questions: ProgramQuestion[];
}

export interface ProgramMessage {
  id: string;
  author: "applicant" | "sponsor";
  body: string;
  createdAt: string;
}

export interface ProgramIntakeOptions {
  view: "discover" | "mine" | "sponsor";
  locale: Locale;
  token: string | null;
  organizationId: string | null;
  onSignIn?: () => void;
}
