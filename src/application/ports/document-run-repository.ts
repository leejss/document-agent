import type {
  DocumentPlan,
  DocumentRequest,
  ReviewReport,
  SectionDraft,
} from "../../domain/document.ts";

export interface CreateDocumentRunInput {
  documentId: string;
  mode: "generate" | "patch";
  request: DocumentRequest | Partial<DocumentRequest>;
  sourcePath?: string;
  outputPath?: string;
}

export interface DocumentRunRecord {
  id: string;
  mode: "generate" | "patch";
  status: string;
  requestJson: string;
  title?: string;
  outputPath?: string;
  sourcePath?: string;
  planJson?: string;
  reviewJson?: string;
  mergedDraft?: string;
  finalMarkdown?: string;
}

export interface DocumentRunRepository {
  initialize(): void;
  createDocumentRun(input: CreateDocumentRunInput): void;
  savePlan(documentId: string, plan: DocumentPlan): void;
  saveSectionDraft(documentId: string, draft: SectionDraft, attempt: number): void;
  saveMergedDraft(documentId: string, markdown: string): void;
  saveReview(documentId: string, review: ReviewReport): void;
  appendLog(
    documentId: string,
    level: "info" | "debug" | "warn" | "error",
    stage: string,
    message: string,
    payload?: Record<string, unknown>,
  ): void;
  completeDocument(documentId: string, title: string, markdown: string, outputPath?: string): void;
  markFailed(documentId: string, message: string): void;
  getDocumentRun(documentId: string): DocumentRunRecord | null;
}
