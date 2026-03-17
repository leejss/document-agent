import type { DocumentRuntimeState } from "./runtime.ts";
import type { ReviewResult } from "./review.ts";

export interface GeneratedDocumentResult {
  finalDocument: string;
  state: DocumentRuntimeState;
  review: ReviewResult;
}
