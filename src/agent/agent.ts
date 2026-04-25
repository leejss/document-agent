import { Context, Effect, Layer } from "effect";
import type { DocumentRequest } from "../document/request.ts";
import type { DocumentPlan, SectionPlan } from "../document/plan.ts";
import type { SectionDraft } from "../document/draft.ts";
import type { ReviewReport } from "../document/review.ts";
import { normalizeRequest } from "../document/request.ts";
import { wordCount } from "../document/util.ts";
import { normalizeReviewReport } from "../document/review.ts";
import { buildExecutionBatches } from "./scheduler.ts";
import { Client as LlmClient, type Interface as LlmClientInterface } from "../llm/client.ts";
import { Repository, type Interface as RepositoryInterface } from "../repo/repository.ts";
import { Store } from "../store/store.ts";
import { Logger, type Interface as LoggerInterface } from "../log/logger.ts";
import type { DocumentAgentError, FilePersistenceError } from "../error/error.ts";

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

export interface Interface {
  readonly generate: (request: DocumentRequest) => Effect.Effect<GenerateResult, DocumentAgentError>;
  readonly patch: (
    path: string,
    sectionTitle: string,
    request: Partial<DocumentRequest> & { verbose: boolean; stdout: boolean; outputPath?: string },
  ) => Effect.Effect<PatchResult, DocumentAgentError>;
}

export class Service extends Context.Tag("DocumentAgent")<Service, Interface>() {}

type LogFn = (
  level: Parameters<LoggerInterface["log"]>[0],
  stage: string,
  message: string,
  payload?: Record<string, unknown>,
) => Effect.Effect<void, FilePersistenceError>;

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const llm = yield* LlmClient;
    const repo = yield* Repository;
    const store = yield* Store;
    const logger = yield* Logger;

    const makeLog = (documentId: string): LogFn =>
      (level, stage, message, payload) =>
        Effect.gen(function* () {
          yield* logger.log(level, message, payload);
          yield* repo.appendLog(documentId, level, stage, message, payload);
        });

    const generate = Effect.fn("Agent.generate")(function* (request: DocumentRequest) {
      const normalized = normalizeRequest(request);
      const documentId = yield* Effect.sync(() => crypto.randomUUID());
      const log = makeLog(documentId);

      yield* repo.createDocumentRun({
        documentId,
        mode: "generate",
        request: normalized,
        outputPath: normalized.outputPath,
      });

      const main = Effect.gen(function* () {
        yield* log("info", "request", "요청 분석 중...", { prompt: normalized.prompt });

        const plan = yield* llm.planDocument(normalized);
        yield* repo.savePlan(documentId, plan);
        yield* log("info", "planner", "아웃라인 생성 완료", { title: plan.title, sections: plan.sections.length });

        const sectionDrafts = yield* writeSections(documentId, normalized, plan.sections, plan, llm, repo, log);

        const intro = yield* llm.writeFrame({ kind: "intro", request: normalized, plan, sectionDrafts });
        const conclusion = yield* llm.writeFrame({ kind: "conclusion", request: normalized, plan, sectionDrafts });

        let edited = yield* llm.editDocument({ request: normalized, plan, intro, sections: sectionDrafts, conclusion });
        yield* repo.saveMergedDraft(documentId, edited);
        yield* log("info", "editor", "문서 편집 완료", { words: wordCount(edited) });

        let review = normalizeReviewReport(
          yield* llm.reviewDocument({ request: normalized, plan, markdown: edited }),
        );
        yield* repo.saveReview(documentId, review);
        yield* log("info", "reviewer", "리뷰 완료", { passed: review.passed, weakSections: review.weakSections });

        if (!review.passed && review.weakSections.length > 0) {
          yield* log("info", "patch", "약한 섹션 보강 시작", { targets: review.weakSections });
          const patchedDrafts = yield* patchWeakSections(
            documentId,
            normalized,
            plan.sections,
            sectionDrafts,
            edited,
            review,
            plan,
            llm,
            repo,
          );
          edited = yield* llm.editDocument({ request: normalized, plan, intro, sections: patchedDrafts, conclusion });
          yield* repo.saveMergedDraft(documentId, edited);
          review = normalizeReviewReport(
            yield* llm.reviewDocument({ request: normalized, plan, markdown: edited }),
          );
          yield* repo.saveReview(documentId, review);
        }

        if (normalized.outputPath) {
          yield* store.write(normalized.outputPath, edited);
        }

        yield* repo.completeDocument(documentId, plan.title, edited, normalized.outputPath);
        yield* log("info", "final", "문서 생성 완료", { outputPath: normalized.outputPath ?? null });

        return {
          documentId,
          title: plan.title,
          markdown: edited,
          outputPath: normalized.outputPath,
          review,
        };
      });

      return yield* main.pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* repo.markFailed(documentId, error instanceof Error ? error.message : "알 수 없는 오류");
            return yield* Effect.fail(error as DocumentAgentError);
          }),
        ),
      );
    });

    const patch = Effect.fn("Agent.patch")(function* (
      path: string,
      sectionTitle: string,
      request: Partial<DocumentRequest> & { verbose: boolean; stdout: boolean; outputPath?: string },
    ) {
      const documentId = yield* Effect.sync(() => crypto.randomUUID());
      const log = makeLog(documentId);

      yield* repo.createDocumentRun({
        documentId,
        mode: "patch",
        request,
        sourcePath: path,
        outputPath: request.outputPath ?? path,
      });

      const main = Effect.gen(function* () {
        const original = yield* store.read(path);
        const currentSection = yield* store.extractSection(original, sectionTitle);
        const replacement = yield* llm.patchExistingSection({ documentMarkdown: original, sectionTitle, request });
        const nextMarkdown = yield* store.replaceSection(original, sectionTitle, replacement);
        const targetPath = request.outputPath ?? path;
        yield* store.write(targetPath, nextMarkdown);
        yield* repo.completeDocument(documentId, sectionTitle, nextMarkdown, targetPath);
        yield* log("info", "patch", "섹션 패치 완료", {
          sectionTitle,
          outputPath: targetPath,
          previousWords: wordCount(currentSection.body),
        });

        return {
          documentId,
          sectionTitle,
          markdown: nextMarkdown,
          outputPath: targetPath,
        };
      });

      return yield* main.pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* repo.markFailed(documentId, error instanceof Error ? error.message : "알 수 없는 오류");
            return yield* Effect.fail(error as DocumentAgentError);
          }),
        ),
      );
    });

    return Service.of({ generate, patch });
  }),
);

function writeSections(
  documentId: string,
  request: DocumentRequest,
  sections: SectionPlan[],
  plan: DocumentPlan,
  llm: LlmClientInterface,
  repo: RepositoryInterface,
  log: LogFn,
): Effect.Effect<SectionDraft[], DocumentAgentError> {
  return Effect.gen(function* () {
    const batches = buildExecutionBatches(sections, request.parallel);
    const completed: SectionDraft[] = [];

    for (const batch of batches) {
      yield* log("info", "executor", "섹션 초안 작성 중...", { batch: batch.map((s) => s.title) });

      const drafts = yield* Effect.all(
        batch.map((section) =>
          Effect.gen(function* () {
            const draft = yield* llm.writeSection({ request, plan, section, completedSections: completed });
            yield* repo.saveSectionDraft(documentId, draft, 1);
            return draft;
          }),
        ),
        { concurrency: "unbounded" },
      );

      completed.push(...drafts);
    }

    return sections
      .map((section) => completed.find((draft) => draft.sectionId === section.id))
      .filter((draft): draft is SectionDraft => Boolean(draft));
  });
}

function patchWeakSections(
  documentId: string,
  request: DocumentRequest,
  sections: SectionPlan[],
  currentDrafts: SectionDraft[],
  editedDocument: string,
  review: ReviewReport,
  plan: DocumentPlan,
  llm: LlmClientInterface,
  repo: RepositoryInterface,
): Effect.Effect<SectionDraft[], DocumentAgentError> {
  return Effect.gen(function* () {
    const nextDrafts = [...currentDrafts];
    for (const sectionTitle of review.weakSections) {
      const planSection = sections.find((section) => section.title === sectionTitle);
      const currentDraft = nextDrafts.find((draft) => draft.title === sectionTitle);
      if (!planSection || !currentDraft) {
        continue;
      }

      const patched = yield* llm.patchSection({
        request,
        plan,
        documentMarkdown: editedDocument,
        targetSection: planSection,
        currentSectionMarkdown: currentDraft.markdown,
        review,
      });
      yield* repo.saveSectionDraft(documentId, patched, 2);
      const index = nextDrafts.findIndex((draft) => draft.sectionId === patched.sectionId);
      nextDrafts[index] = patched;
    }
    return nextDrafts;
  });
}

export * as Agent from "./agent";
