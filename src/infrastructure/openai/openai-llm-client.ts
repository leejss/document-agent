import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type {
  EditDocumentInput,
  LlmClient,
  PatchExistingDocumentInput,
  PatchSectionInput,
  ReviewDocumentInput,
  WriteFrameInput,
  WriteSectionInput,
} from "../../application/ports/llm-client.ts";
import {
  buildLengthPolicy,
  estimateSectionMinWords,
  normalizeRequest,
  wordCount,
} from "../../domain/document.ts";
import type {
  DocumentPlan,
  DocumentRequest,
  ReviewReport,
  SectionDraft,
} from "../../domain/document.ts";
import { ExternalDependencyError, WorkflowError } from "../../domain/errors.ts";

const plannerSchema = z.object({
  title: z.string(),
  globalBrief: z.object({
    topic: z.string(),
    audience: z.string(),
    purpose: z.string(),
    glossary: z.array(z.string()).default([]),
    styleGuide: z.array(z.string()).default([]),
    lengthPolicy: z.string(),
    duplicationRules: z.array(z.string()).default([]),
  }),
  outline: z.array(z.string()).min(5).max(9),
  sections: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        goal: z.string(),
        keyPoints: z.array(z.string()).min(2),
        minWords: z.number().int().positive(),
        dependsOn: z.array(z.string()).default([]),
        parallelizable: z.boolean(),
        avoidOverlapWith: z.array(z.string()).default([]),
        status: z
          .enum(["todo", "ready", "writing", "written", "editing", "done", "failed"])
          .default("todo"),
      }),
    )
    .min(5)
    .max(9),
  introBrief: z.string(),
  conclusionBrief: z.string(),
});

const reviewSchema = z.object({
  passed: z.boolean(),
  issues: z.array(
    z.object({
      sectionTitle: z.string().optional(),
      severity: z.enum(["low", "medium", "high"]),
      message: z.string(),
      recommendation: z.string(),
    }),
  ),
  weakSections: z.array(z.string()).default([]),
  missingSections: z.array(z.string()).default([]),
  lengthViolations: z.array(z.string()).default([]),
  summary: z.string(),
});

export class OpenAiLlmClient implements LlmClient {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model = process.env.OPENAI_MODEL ?? "gpt-5.2",
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async planDocument(request: DocumentRequest): Promise<DocumentPlan> {
    const normalized = normalizeRequest(request);
    const length = normalized.length ?? "medium";
    const prompt = [
      "당신은 긴 기술 문서를 설계하는 planner다.",
      "출력은 반드시 JSON schema를 따라야 한다.",
      "섹션 수는 5~9개 사이여야 한다.",
      "각 섹션은 분명한 목적, 핵심 포인트, 중복 회피 규칙, dependency를 가져야 한다.",
      `문서 형식: ${normalized.format}`,
      `대상 독자: ${normalized.audience}`,
      `문서 목적: ${normalized.purpose}`,
      `톤: ${normalized.tone}`,
      `길이 정책: ${buildLengthPolicy(length)}`,
      `반드시 포함할 섹션: ${normalized.requiredSections.join(", ") || "없음"}`,
      `추가 제약: ${normalized.constraints.join(" | ") || "없음"}`,
      `사용자 요청: ${normalized.prompt}`,
    ].join("\n");

    const parsed = await this.parseStructured(prompt, plannerSchema, "document_plan");
    return {
      ...parsed,
      sections: parsed.sections.map((section) => ({
        ...section,
        minWords: Math.max(section.minWords, estimateSectionMinWords(length)),
        status: "todo",
      })),
    };
  }

  async writeSection(input: WriteSectionInput): Promise<SectionDraft> {
    const prompt = [
      "당신은 section executor다.",
      "출력은 Markdown만 반환한다.",
      "반드시 섹션 제목으로 시작하고, 충분한 설명과 예시를 포함한다.",
      `문서 제목: ${input.plan.title}`,
      `문서 목적: ${input.plan.globalBrief.purpose}`,
      `대상 독자: ${input.plan.globalBrief.audience}`,
      `용어집: ${input.plan.globalBrief.glossary.join(", ") || "없음"}`,
      `중복 방지 규칙: ${input.plan.globalBrief.duplicationRules.join(" | ") || "없음"}`,
      `이미 작성된 섹션: ${input.completedSections.map((section) => section.title).join(", ") || "없음"}`,
      `현재 섹션 제목: ${input.section.title}`,
      `목표: ${input.section.goal}`,
      `핵심 포인트: ${input.section.keyPoints.join(" | ")}`,
      `겹치지 말아야 할 섹션: ${input.section.avoidOverlapWith.join(", ") || "없음"}`,
      `최소 단어 수: ${input.section.minWords}`,
    ].join("\n");

    return this.retryOnce(() => this.generateSectionDraft(input.section.id, input.section.title, prompt));
  }

  async writeFrame(input: WriteFrameInput): Promise<SectionDraft> {
    const brief = input.kind === "intro" ? input.plan.introBrief : input.plan.conclusionBrief;
    const title = input.kind === "intro" ? "서론" : "결론";
    const prompt = [
      `당신은 문서의 ${title} 작성자다.`,
      "출력은 Markdown만 반환한다.",
      `문서 제목: ${input.plan.title}`,
      `브리프: ${brief}`,
      `본문 섹션 제목: ${input.sectionDrafts.map((section) => section.title).join(", ")}`,
      "문서 전체 흐름을 자연스럽게 연결하라.",
    ].join("\n");

    return this.generateSectionDraft(input.kind, title, prompt);
  }

  async editDocument(input: EditDocumentInput): Promise<string> {
    const prompt = [
      "당신은 editor다.",
      "출력은 완성된 Markdown 문서만 반환한다.",
      "문서를 과도하게 압축하지 말고 용어와 톤을 통일한다.",
      "중복을 제거하되 각 섹션의 깊이는 유지한다.",
      `문서 제목: ${input.plan.title}`,
      `톤 가이드: ${input.plan.globalBrief.styleGuide.join(" | ") || input.request.tone || "formal"}`,
      "아래 초안을 통합하라:",
      [input.intro.markdown, ...input.sections.map((section) => section.markdown), input.conclusion.markdown].join("\n\n"),
    ].join("\n");

    return this.generateMarkdown(prompt);
  }

  async reviewDocument(input: ReviewDocumentInput): Promise<ReviewReport> {
    const prompt = [
      "당신은 reviewer다.",
      "출력은 반드시 JSON schema를 따라야 한다.",
      "필수 섹션 누락, 길이 부족, 논리 흐름 약점, 중복 가능성을 검사한다.",
      `문서 제목: ${input.plan.title}`,
      `필수 섹션: ${input.plan.outline.join(", ")}`,
      `길이 정책: ${input.plan.globalBrief.lengthPolicy}`,
      "문서 본문:",
      input.markdown,
    ].join("\n");

    return this.parseStructured(prompt, reviewSchema, "review_report");
  }

  async patchSection(input: PatchSectionInput): Promise<SectionDraft> {
    const prompt = [
      "당신은 약한 섹션만 보강하는 patch writer다.",
      "출력은 Markdown만 반환한다.",
      `대상 섹션 제목: ${input.targetSection.title}`,
      `현재 섹션 내용:\n${input.currentSectionMarkdown}`,
      `리뷰 요약: ${input.review.summary}`,
      `해당 섹션 관련 이슈: ${input.review.issues
        .filter((issue) => issue.sectionTitle === input.targetSection.title)
        .map((issue) => `${issue.severity}: ${issue.message} / ${issue.recommendation}`)
        .join(" | ") || "구체적 이슈 없음"}`,
      `최소 단어 수: ${input.targetSection.minWords}`,
      "설명, 예시, 근거를 추가해 섹션을 강화하라.",
    ].join("\n");

    return this.retryOnce(() =>
      this.generateSectionDraft(input.targetSection.id, input.targetSection.title, prompt),
    );
  }

  async patchExistingSection(input: PatchExistingDocumentInput): Promise<string> {
    const prompt = [
      "당신은 기존 Markdown 문서의 특정 섹션만 재작성하는 편집자다.",
      "출력은 대상 섹션 하나의 Markdown만 반환한다.",
      `대상 섹션 제목: ${input.sectionTitle}`,
      `추가 독자 힌트: ${input.request.audience ?? "없음"}`,
      `추가 목적 힌트: ${input.request.purpose ?? "없음"}`,
      `길이 힌트: ${input.request.length ?? "medium"}`,
      "문서 전체 문맥:",
      input.documentMarkdown,
    ].join("\n");

    return this.generateMarkdown(prompt);
  }

  private async retryOnce<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch {
      return work();
    }
  }

  private async generateSectionDraft(sectionId: string, title: string, prompt: string): Promise<SectionDraft> {
    const markdown = await this.generateMarkdown(prompt);
    return {
      sectionId,
      title,
      markdown,
      status: "written",
      wordCount: wordCount(markdown),
    };
  }

  private async generateMarkdown(prompt: string): Promise<string> {
    try {
      const response = await this.client.responses.create({
        model: this.model,
        input: prompt,
      });

      const text = response.output_text?.trim();
      if (!text) {
        throw new WorkflowError("LLM이 Markdown 응답을 비워서 반환했습니다.");
      }

      return text;
    } catch (error) {
      if (error instanceof WorkflowError) {
        throw error;
      }
      throw new ExternalDependencyError("LLM Markdown 생성에 실패했습니다.", error);
    }
  }

  private async parseStructured<T extends z.ZodTypeAny>(
    prompt: string,
    schema: T,
    schemaName: string,
  ): Promise<z.infer<T>> {
    try {
      const response = await this.client.responses.parse({
        model: this.model,
        input: prompt,
        text: {
          format: zodTextFormat(schema, schemaName),
        },
      });

      const parsed = response.output_parsed;
      if (!parsed) {
        throw new WorkflowError("구조화 응답을 파싱하지 못했습니다.");
      }
      return schema.parse(parsed);
    } catch (error) {
      if (error instanceof WorkflowError) {
        throw error;
      }
      throw new ExternalDependencyError("LLM 구조화 응답 생성에 실패했습니다.", error);
    }
  }
}
