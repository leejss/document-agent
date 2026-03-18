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
import type { DocumentPlan, DocumentRequest, ReviewReport, SectionDraft } from "../../domain/document.ts";
import {
  estimateSectionMinWords,
  normalizeRequest,
  wordCount
} from "../../domain/document.ts";
import { ExternalDependencyError, WorkflowError } from "../../domain/errors.ts";
import {
  buildEditDocumentPrompt,
  buildPatchExistingSectionPrompt,
  buildPatchSectionPrompt,
  buildPlanDocumentPrompt,
  buildReviewDocumentPrompt,
  buildWriteFramePrompt,
  buildWriteSectionPrompt,
} from "./document-prompt-factory.ts";
import { plannerSchema, reviewSchema } from "./document-schemas.ts";

export interface OpenAiCompatibleLlmClientOptions {
  apiKey: string;
  model: string;
  baseURL?: string;
  providerLabel: string;
}

export abstract class OpenAiCompatibleLlmClientBase implements LlmClient {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly providerLabel: string;

  protected constructor(options: OpenAiCompatibleLlmClientOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    });
    this.model = options.model;
    this.providerLabel = options.providerLabel;
  }

  async planDocument(request: DocumentRequest): Promise<DocumentPlan> {
    const normalized = normalizeRequest(request);
    const length = normalized.length ?? "medium";
    const parsed = await this.parseStructured(buildPlanDocumentPrompt(normalized), plannerSchema, "document_plan");
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
    return this.retryOnce(() =>
      this.generateSectionDraft(input.section.id, input.section.title, buildWriteSectionPrompt(input)),
    );
  }

  async writeFrame(input: WriteFrameInput): Promise<SectionDraft> {
    const title = input.kind === "intro" ? "서론" : "결론";
    return this.generateSectionDraft(input.kind, title, buildWriteFramePrompt(input));
  }

  async editDocument(input: EditDocumentInput): Promise<string> {
    return this.generateMarkdown(buildEditDocumentPrompt(input));
  }

  async reviewDocument(input: ReviewDocumentInput): Promise<ReviewReport> {
    return this.parseStructured(buildReviewDocumentPrompt(input), reviewSchema, "review_report");
  }

  async patchSection(input: PatchSectionInput): Promise<SectionDraft> {
    return this.retryOnce(() =>
      this.generateSectionDraft(input.targetSection.id, input.targetSection.title, buildPatchSectionPrompt(input)),
    );
  }

  async patchExistingSection(input: PatchExistingDocumentInput): Promise<string> {
    return this.generateMarkdown(buildPatchExistingSectionPrompt(input));
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

  protected async parseStructured<T extends z.ZodTypeAny>(
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
