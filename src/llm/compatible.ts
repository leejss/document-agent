import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { Effect } from "effect";
import type {
  EditDocumentInput,
  PatchExistingDocumentInput,
  PatchSectionInput,
  ReviewDocumentInput,
  WriteFrameInput,
  WriteSectionInput,
} from "./client.ts";
import type { DocumentPlan, SectionPlan } from "../document/plan.ts";
import type { DocumentRequest } from "../document/request.ts";
import type { ReviewReport } from "../document/review.ts";
import type { SectionDraft } from "../document/draft.ts";
import { estimateSectionMinWords, normalizeRequest } from "../document/request.ts";
import { wordCount } from "../document/util.ts";
import { ExternalDependencyError, WorkflowError } from "../error/error.ts";
import {
  buildEditDocumentPrompt,
  buildPatchExistingSectionPrompt,
  buildPatchSectionPrompt,
  buildPlanDocumentPrompt,
  buildReviewDocumentPrompt,
  buildWriteFramePrompt,
  buildWriteSectionPrompt,
} from "./prompt.ts";
import { plannerSchema, reviewSchema } from "./schema.ts";

export interface OpenAiCompatibleClientOptions {
  apiKey: string;
  model: string;
  baseURL?: string;
  providerLabel: string;
}

export abstract class OpenAiCompatibleClientBase {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly providerLabel: string;

  protected constructor(options: OpenAiCompatibleClientOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    });
    this.model = options.model;
    this.providerLabel = options.providerLabel;
  }

  planDocument(request: DocumentRequest): Effect.Effect<DocumentPlan, ExternalDependencyError | WorkflowError> {
    return Effect.tryPromise({
      try: () => this.planDocumentPromise(request),
      catch: (error) =>
        error instanceof WorkflowError ? error : new ExternalDependencyError(`${this.providerLabel} plan 생성 실패`, error),
    });
  }

  writeSection(input: WriteSectionInput): Effect.Effect<SectionDraft, ExternalDependencyError | WorkflowError> {
    return Effect.tryPromise({
      try: () => this.retryOnce(() => this.generateSectionDraft(input.section.id, input.section.title, buildWriteSectionPrompt(input))),
      catch: (error) =>
        error instanceof WorkflowError ? error : new ExternalDependencyError(`${this.providerLabel} 섹션 작성 실패`, error),
    });
  }

  writeFrame(input: WriteFrameInput): Effect.Effect<SectionDraft, ExternalDependencyError | WorkflowError> {
    const title = input.kind === "intro" ? "서론" : "결론";
    return Effect.tryPromise({
      try: () => this.generateSectionDraft(input.kind, title, buildWriteFramePrompt(input)),
      catch: (error) =>
        error instanceof WorkflowError ? error : new ExternalDependencyError(`${this.providerLabel} 프레임 작성 실패`, error),
    });
  }

  editDocument(input: EditDocumentInput): Effect.Effect<string, ExternalDependencyError | WorkflowError> {
    return Effect.tryPromise({
      try: () => this.generateMarkdown(buildEditDocumentPrompt(input)),
      catch: (error) =>
        error instanceof WorkflowError ? error : new ExternalDependencyError(`${this.providerLabel} 문서 편집 실패`, error),
    });
  }

  reviewDocument(input: ReviewDocumentInput): Effect.Effect<ReviewReport, ExternalDependencyError | WorkflowError> {
    return Effect.tryPromise({
      try: () => this.parseStructured(buildReviewDocumentPrompt(input), reviewSchema, "review_report"),
      catch: (error) =>
        error instanceof WorkflowError ? error : new ExternalDependencyError(`${this.providerLabel} 리뷰 실패`, error),
    });
  }

  patchSection(input: PatchSectionInput): Effect.Effect<SectionDraft, ExternalDependencyError | WorkflowError> {
    return Effect.tryPromise({
      try: () =>
        this.retryOnce(() =>
          this.generateSectionDraft(input.targetSection.id, input.targetSection.title, buildPatchSectionPrompt(input)),
        ),
      catch: (error) =>
        error instanceof WorkflowError ? error : new ExternalDependencyError(`${this.providerLabel} 섹션 패치 실패`, error),
    });
  }

  patchExistingSection(input: PatchExistingDocumentInput): Effect.Effect<string, ExternalDependencyError | WorkflowError> {
    return Effect.tryPromise({
      try: () => this.generateMarkdown(buildPatchExistingSectionPrompt(input)),
      catch: (error) =>
        error instanceof WorkflowError ? error : new ExternalDependencyError(`${this.providerLabel} 기존 섹션 패치 실패`, error),
    });
  }

  private async planDocumentPromise(request: DocumentRequest): Promise<DocumentPlan> {
    const normalized = normalizeRequest(request);
    const length = normalized.length ?? "medium";
    const parsed = await this.parseStructured(buildPlanDocumentPrompt(normalized), plannerSchema, "document_plan");
    return {
      ...parsed,
      sections: parsed.sections.map((section) => ({
        ...section,
        minWords: Math.max(section.minWords, estimateSectionMinWords(length)),
        status: "todo" as const,
      })),
    };
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

  protected async generateMarkdown(prompt: string): Promise<string> {
    try {
      const response = await this.client.responses.create({
        model: this.model,
        input: prompt,
      });

      const text = response.output_text?.trim();
      if (!text) {
        throw new WorkflowError(`${this.providerLabel}가 Markdown 응답을 비워서 반환했습니다.`);
      }

      return text;
    } catch (error) {
      if (error instanceof WorkflowError) {
        throw error;
      }
      throw new ExternalDependencyError(`${this.providerLabel} Markdown 생성에 실패했습니다.`, error);
    }
  }

  protected async parseStructured<T extends z.ZodTypeAny>(prompt: string, schema: T, schemaName: string): Promise<z.infer<T>> {
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
        throw new WorkflowError(`${this.providerLabel} 구조화 응답을 파싱하지 못했습니다.`);
      }
      return schema.parse(parsed);
    } catch (error) {
      if (error instanceof WorkflowError) {
        throw error;
      }
      throw new ExternalDependencyError(`${this.providerLabel} 구조화 응답 생성에 실패했습니다.`, error);
    }
  }
}
