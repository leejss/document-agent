import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { Effect, Layer } from "effect";
import { Client } from "./client.ts";
import type {
	EditDocumentInput,
	PatchExistingDocumentInput,
	PatchSectionInput,
	ReviewDocumentInput,
	WriteFrameInput,
	WriteSectionInput,
} from "./client.ts";
import type { DocumentPlan } from "../document/plan.ts";
import type { DocumentRequest } from "../document/request.ts";
import type { ReviewReport } from "../document/review.ts";
import type { SectionDraft } from "../document/draft.ts";
import {
	estimateSectionMinWords,
	normalizeRequest,
} from "../document/request.ts";
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

class AnthropicClient {
	private readonly client: Anthropic;

	constructor(
		apiKey: string,
		private readonly model = process.env.ANTHROPIC_MODEL ??
			"claude-sonnet-4-20250514",
	) {
		this.client = new Anthropic({ apiKey });
	}

	planDocument(
		request: DocumentRequest,
	): Effect.Effect<DocumentPlan, ExternalDependencyError | WorkflowError> {
		return Effect.tryPromise({
			try: () => this.planDocumentPromise(request),
			catch: (error) =>
				error instanceof WorkflowError
					? error
					: new ExternalDependencyError("Anthropic plan 생성 실패", error),
		});
	}

	writeSection(
		input: WriteSectionInput,
	): Effect.Effect<SectionDraft, ExternalDependencyError | WorkflowError> {
		return Effect.tryPromise({
			try: () =>
				this.retryOnce(() =>
					this.generateSectionDraft(
						input.section.id,
						input.section.title,
						buildWriteSectionPrompt(input),
					),
				),
			catch: (error) =>
				error instanceof WorkflowError
					? error
					: new ExternalDependencyError("Anthropic 섹션 작성 실패", error),
		});
	}

	writeFrame(
		input: WriteFrameInput,
	): Effect.Effect<SectionDraft, ExternalDependencyError | WorkflowError> {
		const title = input.kind === "intro" ? "서론" : "결론";
		return Effect.tryPromise({
			try: () =>
				this.generateSectionDraft(
					input.kind,
					title,
					buildWriteFramePrompt(input),
				),
			catch: (error) =>
				error instanceof WorkflowError
					? error
					: new ExternalDependencyError("Anthropic 프레임 작성 실패", error),
		});
	}

	editDocument(
		input: EditDocumentInput,
	): Effect.Effect<string, ExternalDependencyError | WorkflowError> {
		return Effect.tryPromise({
			try: () => this.generateMarkdown(buildEditDocumentPrompt(input)),
			catch: (error) =>
				error instanceof WorkflowError
					? error
					: new ExternalDependencyError("Anthropic 문서 편집 실패", error),
		});
	}

	reviewDocument(
		input: ReviewDocumentInput,
	): Effect.Effect<ReviewReport, ExternalDependencyError | WorkflowError> {
		return Effect.tryPromise({
			try: () =>
				this.parseStructured(buildReviewDocumentPrompt(input), reviewSchema),
			catch: (error) =>
				error instanceof WorkflowError
					? error
					: new ExternalDependencyError("Anthropic 리뷰 실패", error),
		});
	}

	patchSection(
		input: PatchSectionInput,
	): Effect.Effect<SectionDraft, ExternalDependencyError | WorkflowError> {
		return Effect.tryPromise({
			try: () =>
				this.retryOnce(() =>
					this.generateSectionDraft(
						input.targetSection.id,
						input.targetSection.title,
						buildPatchSectionPrompt(input),
					),
				),
			catch: (error) =>
				error instanceof WorkflowError
					? error
					: new ExternalDependencyError("Anthropic 섹션 패치 실패", error),
		});
	}

	patchExistingSection(
		input: PatchExistingDocumentInput,
	): Effect.Effect<string, ExternalDependencyError | WorkflowError> {
		return Effect.tryPromise({
			try: () => this.generateMarkdown(buildPatchExistingSectionPrompt(input)),
			catch: (error) =>
				error instanceof WorkflowError
					? error
					: new ExternalDependencyError("Anthropic 기존 섹션 패치 실패", error),
		});
	}

	private async planDocumentPromise(
		request: DocumentRequest,
	): Promise<DocumentPlan> {
		const normalized = normalizeRequest(request);
		const length = normalized.length ?? "medium";
		const parsed = await this.parseStructured(
			buildPlanDocumentPrompt(normalized),
			plannerSchema,
		);
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

	private async generateSectionDraft(
		sectionId: string,
		title: string,
		prompt: string,
	): Promise<SectionDraft> {
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
				throw new WorkflowError(
					"Anthropic이 Markdown 응답을 비워서 반환했습니다.",
				);
			}

			return text;
		} catch (error) {
			if (error instanceof WorkflowError) {
				throw error;
			}
			throw new ExternalDependencyError(
				"Anthropic Markdown 생성에 실패했습니다.",
				error,
			);
		}
	}

	private async parseStructured<T extends z.ZodTypeAny>(
		prompt: string,
		schema: T,
	): Promise<z.infer<T>> {
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
			throw new ExternalDependencyError(
				"Anthropic 구조화 응답 생성에 실패했습니다.",
				error,
			);
		}
	}
}

export const layer = Layer.succeed(
	Client,
	new AnthropicClient(process.env.ANTHROPIC_API_KEY ?? ""),
);
