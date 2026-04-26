import { Context, type Effect } from "effect";
import type { SectionDraft } from "../document/draft.ts";
import type { DocumentPlan } from "../document/plan.ts";
import type { DocumentRequest } from "../document/request.ts";
import type { ReviewReport } from "../document/review.ts";
import type { FilePersistenceError } from "../error/error.ts";

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

export interface Interface {
	readonly initialize: () => Effect.Effect<void, FilePersistenceError>;
	readonly createDocumentRun: (
		input: CreateDocumentRunInput,
	) => Effect.Effect<void, FilePersistenceError>;
	readonly savePlan: (
		documentId: string,
		plan: DocumentPlan,
	) => Effect.Effect<void, FilePersistenceError>;
	readonly saveSectionDraft: (
		documentId: string,
		draft: SectionDraft,
		attempt: number,
	) => Effect.Effect<void, FilePersistenceError>;
	readonly saveMergedDraft: (
		documentId: string,
		markdown: string,
	) => Effect.Effect<void, FilePersistenceError>;
	readonly saveReview: (
		documentId: string,
		review: ReviewReport,
	) => Effect.Effect<void, FilePersistenceError>;
	readonly appendLog: (
		documentId: string,
		level: "info" | "debug" | "warn" | "error",
		stage: string,
		message: string,
		payload?: Record<string, unknown>,
	) => Effect.Effect<void, FilePersistenceError>;
	readonly completeDocument: (
		documentId: string,
		title: string,
		markdown: string,
		outputPath?: string,
	) => Effect.Effect<void, FilePersistenceError>;
	readonly markFailed: (
		documentId: string,
		message: string,
	) => Effect.Effect<void, FilePersistenceError>;
	readonly getDocumentRun: (
		documentId: string,
	) => Effect.Effect<DocumentRunRecord | null, FilePersistenceError>;
}

export class Repository extends Context.Tag("DocumentRepository")<
	Repository,
	Interface
>() {}
