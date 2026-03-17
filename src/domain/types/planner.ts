import type { DocumentFormat, DocumentLength, Tone } from "./request.ts";

export interface StyleGuide {
  tone: Tone;
  audienceLevel: "beginner" | "intermediate" | "advanced" | "mixed";
  terminologyRules: string[];
  forbiddenPatterns: string[];
  lengthPolicy: {
    targetLength: DocumentLength;
    minSections: number;
    maxSections: number;
  };
}

export interface GlobalDocumentBrief {
  topic: string;
  purpose: string;
  targetAudience: string;
  documentFormat: DocumentFormat;
  title: string;
  summary: string;
  glossary: string[];
  styleGuide: StyleGuide;
  mustInclude: string[];
  constraints: string[];
  avoidOverlapRules: string[];
}

export type SectionKind =
  | "introduction"
  | "body"
  | "conclusion"
  | "appendix"
  | "faq";

export type SectionRequiredElement =
  | "explanation"
  | "example"
  | "comparison"
  | "code"
  | "checklist";

export interface SectionBrief {
  id: string;
  title: string;
  kind: SectionKind;
  purpose: string;
  keyPoints: string[];
  requiredElements: SectionRequiredElement[];
  minWordCount: number;
  dependencies: string[];
  avoidOverlapWith: string[];
  parallelizable: boolean;
}

export interface OutlinePlan {
  title: string;
  sections: SectionBrief[];
}

export interface ExecutionGroup {
  id: string;
  sectionIds: string[];
  mode: "parallel" | "sequential";
  reason: string;
}

export interface PlannerResult {
  globalBrief: GlobalDocumentBrief;
  outline: OutlinePlan;
  executionGroups: ExecutionGroup[];
  plannerNotes: string[];
}
