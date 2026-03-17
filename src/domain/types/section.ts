export type SectionStatus =
  | "todo"
  | "ready"
  | "writing"
  | "written"
  | "editing"
  | "done"
  | "failed";

export type DraftStatus = "draft" | "reviewed";

export interface SectionDraft {
  sectionId: string;
  content: string;
  status: DraftStatus;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SectionRuntimeState {
  sectionId: string;
  status: SectionStatus;
  attempts: number;
  lastError?: string;
}
