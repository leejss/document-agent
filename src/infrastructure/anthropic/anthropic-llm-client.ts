import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
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
import { estimateSectionMinWords, normalizeRequest, wordCount } from "../../domain/document.ts";
import type { DocumentPlan, DocumentRequest, ReviewReport, SectionDraft } from "../../domain/document.ts";
import { ExternalDependencyError, WorkflowError } from "../../domain/errors.ts";
import {
  buildEditDocumentPrompt,
  buildPatchExistingSectionPrompt,
  buildPatchSectionPrompt,
  buildPlanDocumentPrompt,
  buildReviewDocumentPrompt,
  buildWriteFramePrompt,
  buildWriteSectionPrompt,
} from "../llm/document-prompt-factory.ts";
import { plannerSchema, reviewSchema } from "../llm/document-schemas.ts";

export class AnthropicLlmClient implements LlmClient {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async planDocument(request: DocumentRequest): Promise<DocumentPlan> {
    const normalized = normalizeRequest(request);
    const length = normalized.length ?? "medium";
    const parsed = await this.parseStructured(buildPlanDocumentPrompt(normalized), plannerSchema);
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
    return this.parseStructured(buildReviewDocumentPrompt(input), reviewSchema);
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

  private async generateMarkdown(prompt: string): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim();

      if (!text) {
        throw new WorkflowError("Anthropic이 Markdown 응답을 비워서 반환했습니다.");
      }

      return text;
    } catch (error) {
      if (error instanceof WorkflowError) {
        throw error;
      }
      throw new ExternalDependencyError("Anthropic Markdown 생성에 실패했습니다.", error);
    }
  }

  private async parseStructured<T extends z.ZodTypeAny>(prompt: string, schema: T): Promise<z.infer<T>> {
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
        output_config: {
          format: zodOutputFormat(schema),
        },
      });

      const parsed = response.parsed_output;
      if (!parsed) {
        throw new WorkflowError("Anthropic 구조화 응답을 파싱하지 못했습니다.");
      }

      return schema.parse(parsed);
    } catch (error) {
      if (error instanceof WorkflowError) {
        throw error;
      }
      throw new ExternalDependencyError("Anthropic 구조화 응답 생성에 실패했습니다.", error);
    }
  }
}
