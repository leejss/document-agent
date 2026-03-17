import type { PlannerResult } from "./planner.ts";
import type { NormalizedDocumentRequest } from "./request.ts";
import type { SectionDraft, SectionRuntimeState } from "./section.ts";

export type WorkflowStage =
  | "request-analyzed"
  | "planned"
  | "section-written"
  | "intro-written"
  | "conclusion-written"
  | "edited"
  | "reviewed"
  | "patched"
  | "completed";

export interface WorkflowLog {
  timestamp: string;
  stage: WorkflowStage;
  message: string;
  sectionId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface DocumentRuntimeState {
  request: NormalizedDocumentRequest;
  plannerResult?: PlannerResult;
  sectionStates: Record<string, SectionRuntimeState>;
  sectionDrafts: Record<string, SectionDraft>;
  mergedDraft?: string;
  finalDocument?: string;
  logs: WorkflowLog[];
}
