export type DocumentFormat = "guide" | "prd" | "technical-design" | "proposal" | string;
export type Tone = "formal" | "neutral" | "friendly" | string;
export type LengthLevel = "short" | "medium" | "long";
export type ParallelMode = "auto" | "off";
export type SectionStatus =
  | "todo"
  | "ready"
  | "writing"
  | "written"
  | "editing"
  | "done"
  | "failed";
export type LogLevel = "info" | "debug" | "warn" | "error";

export interface DocumentRequest {
  prompt: string;
  format?: DocumentFormat;
  audience?: string;
  purpose?: string;
  tone?: Tone;
  length?: LengthLevel;
  requiredSections: string[];
  constraints: string[];
  outputPath?: string;
  stdout: boolean;
  verbose: boolean;
  parallel: ParallelMode;
}

export interface GlobalBrief {
  topic: string;
  audience: string;
  purpose: string;
  glossary: string[];
  styleGuide: string[];
  lengthPolicy: string;
  duplicationRules: string[];
}

export interface SectionPlan {
  id: string;
  title: string;
  goal: string;
  keyPoints: string[];
  minWords: number;
  dependsOn: string[];
  parallelizable: boolean;
  avoidOverlapWith: string[];
  status: SectionStatus;
}

export interface DocumentPlan {
  title: string;
  globalBrief: GlobalBrief;
  outline: string[];
  sections: SectionPlan[];
  introBrief: string;
  conclusionBrief: string;
}

export interface SectionDraft {
  sectionId: string;
  title: string;
  markdown: string;
  status: Exclude<SectionStatus, "todo" | "ready">;
  wordCount: number;
}

export interface ReviewIssue {
  sectionTitle?: string;
  severity: "low" | "medium" | "high";
  message: string;
  recommendation: string;
}

export interface ReviewReport {
  passed: boolean;
  issues: ReviewIssue[];
  weakSections: string[];
  missingSections: string[];
  lengthViolations: string[];
  summary: string;
}

export function normalizeReviewReport(review: ReviewReport): ReviewReport {
  const hasBlockingSignals =
    review.weakSections.length > 0 ||
    review.missingSections.length > 0 ||
    review.lengthViolations.length > 0 ||
    review.issues.some((issue) => issue.severity === "high");

  return {
    ...review,
    passed: hasBlockingSignals ? false : review.passed,
  };
}

export interface GenerationJobState {
  documentId: string;
  request: DocumentRequest;
  plan?: DocumentPlan;
  sectionStates: Record<string, SectionStatus>;
  mergedDraft?: string;
  finalDocument?: string;
  logs: string[];
}

export interface GenerateResult {
  documentId: string;
  title: string;
  markdown: string;
  outputPath?: string;
  review: ReviewReport;
}

export interface PatchResult {
  documentId: string;
  sectionTitle: string;
  markdown: string;
  outputPath: string;
}

export interface HeadingSection {
  title: string;
  level: number;
  start: number;
  end: number;
  contentStart: number;
  contentEnd: number;
  headingLine: string;
  body: string;
}

export function defaultLength(level?: LengthLevel): LengthLevel {
  return level ?? "medium";
}

export function defaultParallelMode(mode?: ParallelMode): ParallelMode {
  return mode ?? "auto";
}

export function buildLengthPolicy(length: LengthLevel): string {
  switch (length) {
    case "short":
      return "각 섹션은 핵심 설명 중심으로 최소 180단어 이상 작성한다.";
    case "long":
      return "각 섹션은 예시와 비교를 포함해 최소 420단어 이상 작성한다.";
    case "medium":
    default:
      return "각 섹션은 설명과 예시를 포함해 최소 280단어 이상 작성한다.";
  }
}

export function estimateSectionMinWords(length: LengthLevel): number {
  switch (length) {
    case "short":
      return 180;
    case "long":
      return 420;
    case "medium":
    default:
      return 280;
  }
}

export function normalizeRequest(request: DocumentRequest): DocumentRequest {
  const length = defaultLength(request.length);
  return {
    ...request,
    format: request.format ?? "technical-design",
    audience: request.audience ?? "기술 문서를 읽는 엔지니어",
    purpose: request.purpose ?? "주제를 설명하고 실제 구현 판단에 필요한 근거를 제공한다.",
    tone: request.tone ?? "formal",
    length,
    requiredSections: request.requiredSections,
    constraints: request.constraints,
    parallel: defaultParallelMode(request.parallel),
  };
}

export function wordCount(markdown: string): number {
  return markdown
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}
