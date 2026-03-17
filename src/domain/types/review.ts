export interface ReviewChecklistItemResult {
  key: string;
  passed: boolean;
  message: string;
}

export interface WeakSection {
  sectionId: string;
  reason: string;
  suggestedFixes: string[];
  severity: "low" | "medium" | "high";
}

export interface ReviewResult {
  passed: boolean;
  score: number;
  checklist: ReviewChecklistItemResult[];
  weakSections: WeakSection[];
  globalFeedback: string[];
}

export interface PatchRequest {
  sectionId: string;
  reason: string;
  instructions: string[];
}

export interface PatchResult {
  sectionId: string;
  patchedContent: string;
  changeSummary: string[];
}
