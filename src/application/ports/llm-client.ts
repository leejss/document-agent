import type {
  DocumentPlan,
  DocumentRequest,
  ReviewReport,
  SectionDraft,
  SectionPlan,
} from "../../domain/document.ts";

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

export interface LlmClient {
  planDocument(request: DocumentRequest): Promise<DocumentPlan>;
  writeSection(input: WriteSectionInput): Promise<SectionDraft>;
  writeFrame(input: WriteFrameInput): Promise<SectionDraft>;
  editDocument(input: EditDocumentInput): Promise<string>;
  reviewDocument(input: ReviewDocumentInput): Promise<ReviewReport>;
  patchSection(input: PatchSectionInput): Promise<SectionDraft>;
  patchExistingSection(input: PatchExistingDocumentInput): Promise<string>;
}
