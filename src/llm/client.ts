import { Context, Effect } from "effect";
import type { DocumentPlan, SectionPlan } from "../document/plan.ts";
import type { DocumentRequest } from "../document/request.ts";
import type { SectionDraft } from "../document/draft.ts";
import type { ReviewReport } from "../document/review.ts";
import type { ExternalDependencyError, WorkflowError } from "../error/error.ts";

export interface WriteSectionInput {
  request: DocumentRequest;
  plan: DocumentPlan;
  section: SectionPlan;
  completedSections: SectionDraft[];
}

export interface WriteFrameInput {
  request: DocumentRequest;
  plan: DocumentPlan;
  sectionDrafts: SectionDraft[];
  kind: "intro" | "conclusion";
}

export interface EditDocumentInput {
  request: DocumentRequest;
  plan: DocumentPlan;
  intro: SectionDraft;
  sections: SectionDraft[];
  conclusion: SectionDraft;
}

export interface ReviewDocumentInput {
  request: DocumentRequest;
  plan: DocumentPlan;
  markdown: string;
}

export interface PatchSectionInput {
  request: DocumentRequest;
  plan: DocumentPlan;
  documentMarkdown: string;
  targetSection: SectionPlan;
  currentSectionMarkdown: string;
  review: ReviewReport;
}

export interface PatchExistingDocumentInput {
  documentMarkdown: string;
  sectionTitle: string;
  request: Partial<DocumentRequest>;
}

export interface Interface {
  readonly planDocument: (request: DocumentRequest) => Effect.Effect<DocumentPlan, ExternalDependencyError | WorkflowError>;
  readonly writeSection: (input: WriteSectionInput) => Effect.Effect<SectionDraft, ExternalDependencyError | WorkflowError>;
  readonly writeFrame: (input: WriteFrameInput) => Effect.Effect<SectionDraft, ExternalDependencyError | WorkflowError>;
  readonly editDocument: (input: EditDocumentInput) => Effect.Effect<string, ExternalDependencyError | WorkflowError>;
  readonly reviewDocument: (input: ReviewDocumentInput) => Effect.Effect<ReviewReport, ExternalDependencyError | WorkflowError>;
  readonly patchSection: (input: PatchSectionInput) => Effect.Effect<SectionDraft, ExternalDependencyError | WorkflowError>;
  readonly patchExistingSection: (input: PatchExistingDocumentInput) => Effect.Effect<string, ExternalDependencyError | WorkflowError>;
}

export class Client extends Context.Tag("LlmClient")<Client, Interface>() {}
