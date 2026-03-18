import type { DocumentRunRepository } from "../ports/document-run-repository.ts";
import type { LlmClient } from "../ports/llm-client.ts";
import type { Logger } from "../ports/logger.ts";
import { buildExecutionBatches } from "./scheduler.ts";
import { MarkdownStore } from "../../infrastructure/fs/markdown-store.ts";
import { normalizeRequest, wordCount } from "../../domain/document.ts";
import type {
  DocumentRequest,
  GenerateResult,
  PatchResult,
  ReviewReport,
  SectionDraft,
  SectionPlan,
} from "../../domain/document.ts";

export class DocumentAgent {
  constructor(
    private readonly llm: LlmClient,
    private readonly repository: DocumentRunRepository,
    private readonly logger: Logger,
    private readonly markdownStore: MarkdownStore,
  ) {}

  async generate(request: DocumentRequest): Promise<GenerateResult> {
    const normalized = normalizeRequest(request);
    const documentId = crypto.randomUUID();
    this.repository.createDocumentRun({
      documentId,
      mode: "generate",
      request: normalized,
      outputPath: normalized.outputPath,
    });

    try {
      await this.log(documentId, "info", "request", "요청 분석 중...", { prompt: normalized.prompt });
      const plan = await this.llm.planDocument(normalized);
      this.repository.savePlan(documentId, plan);
      await this.log(documentId, "info", "planner", "아웃라인 생성 완료", {
        title: plan.title,
        sections: plan.sections.length,
      });

      const sectionDrafts = await this.writeSections(documentId, normalized, plan.sections, plan);
      const intro = await this.llm.writeFrame({
        kind: "intro",
        request: normalized,
        plan,
        sectionDrafts,
      });
      const conclusion = await this.llm.writeFrame({
        kind: "conclusion",
        request: normalized,
        plan,
        sectionDrafts,
      });

      let edited = await this.llm.editDocument({
        request: normalized,
        plan,
        intro,
        sections: sectionDrafts,
        conclusion,
      });
      this.repository.saveMergedDraft(documentId, edited);
      await this.log(documentId, "info", "editor", "문서 편집 완료", { words: wordCount(edited) });

      let review = await this.llm.reviewDocument({
        request: normalized,
        plan,
        markdown: edited,
      });
      this.repository.saveReview(documentId, review);
      await this.log(documentId, "info", "reviewer", "리뷰 완료", {
        passed: review.passed,
        weakSections: review.weakSections,
      });

      if (!review.passed && review.weakSections.length > 0) {
        await this.log(documentId, "info", "patch", "약한 섹션 보강 시작", {
          targets: review.weakSections,
        });
        const patchedDrafts = await this.patchWeakSections(
          documentId,
          normalized,
          plan.sections,
          sectionDrafts,
          edited,
          review,
          plan,
        );
        edited = await this.llm.editDocument({
          request: normalized,
          plan,
          intro,
          sections: patchedDrafts,
          conclusion,
        });
        this.repository.saveMergedDraft(documentId, edited);
        review = await this.llm.reviewDocument({
          request: normalized,
          plan,
          markdown: edited,
        });
        this.repository.saveReview(documentId, review);
      }

      if (normalized.outputPath) {
        await this.markdownStore.write(normalized.outputPath, edited);
      }

      this.repository.completeDocument(documentId, plan.title, edited, normalized.outputPath);
      await this.log(documentId, "info", "final", "문서 생성 완료", {
        outputPath: normalized.outputPath ?? null,
      });

      return {
        documentId,
        title: plan.title,
        markdown: edited,
        outputPath: normalized.outputPath,
        review,
      };
    } catch (error) {
      this.repository.markFailed(documentId, error instanceof Error ? error.message : "알 수 없는 오류");
      throw error;
    }
  }

  async patchDocument(
    path: string,
    sectionTitle: string,
    request: Partial<DocumentRequest> & { verbose: boolean; stdout: boolean; outputPath?: string },
  ): Promise<PatchResult> {
    const documentId = crypto.randomUUID();
    this.repository.createDocumentRun({
      documentId,
      mode: "patch",
      request,
      sourcePath: path,
      outputPath: request.outputPath ?? path,
    });

    try {
      const original = await this.markdownStore.read(path);
      const currentSection = this.markdownStore.extractSection(original, sectionTitle);
      const replacement = await this.llm.patchExistingSection({
        documentMarkdown: original,
        sectionTitle,
        request,
      });
      const nextMarkdown = this.markdownStore.replaceSection(original, sectionTitle, replacement);
      const targetPath = request.outputPath ?? path;
      await this.markdownStore.write(targetPath, nextMarkdown);
      this.repository.completeDocument(documentId, sectionTitle, nextMarkdown, targetPath);
      await this.log(documentId, "info", "patch", "섹션 패치 완료", {
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
    } catch (error) {
      this.repository.markFailed(documentId, error instanceof Error ? error.message : "알 수 없는 오류");
      throw error;
    }
  }

  private async writeSections(
    documentId: string,
    request: DocumentRequest,
    sections: SectionPlan[],
    plan: Parameters<LlmClient["writeSection"]>[0]["plan"],
  ): Promise<SectionDraft[]> {
    const batches = buildExecutionBatches(sections, request.parallel);
    const completed: SectionDraft[] = [];

    for (const batch of batches) {
      await this.log(documentId, "info", "executor", "섹션 초안 작성 중...", {
        batch: batch.map((section) => section.title),
      });

      const drafts = await Promise.all(
        batch.map(async (section) => {
          const draft = await this.llm.writeSection({
            request,
            plan,
            section,
            completedSections: completed,
          });
          this.repository.saveSectionDraft(documentId, draft, 1);
          return draft;
        }),
      );

      completed.push(...drafts);
    }

    return sections
      .map((section) => completed.find((draft) => draft.sectionId === section.id))
      .filter((draft): draft is SectionDraft => Boolean(draft));
  }

  private async patchWeakSections(
    documentId: string,
    request: DocumentRequest,
    sections: SectionPlan[],
    currentDrafts: SectionDraft[],
    editedDocument: string,
    review: ReviewReport,
    plan: Parameters<LlmClient["writeSection"]>[0]["plan"],
  ): Promise<SectionDraft[]> {
    const nextDrafts = [...currentDrafts];
    for (const sectionTitle of review.weakSections) {
      const planSection = sections.find((section) => section.title === sectionTitle);
      const currentDraft = nextDrafts.find((draft) => draft.title === sectionTitle);
      if (!planSection || !currentDraft) {
        continue;
      }

      const patched = await this.llm.patchSection({
        request,
        plan,
        documentMarkdown: editedDocument,
        targetSection: planSection,
        currentSectionMarkdown: currentDraft.markdown,
        review,
      });
      this.repository.saveSectionDraft(documentId, patched, 2);
      const index = nextDrafts.findIndex((draft) => draft.sectionId === patched.sectionId);
      nextDrafts[index] = patched;
    }
    return nextDrafts;
  }

  private async log(
    documentId: string,
    level: "info" | "debug" | "warn" | "error",
    stage: string,
    message: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    this.logger.log(level, message, payload);
    this.repository.appendLog(documentId, level, stage, message, payload);
  }
}
