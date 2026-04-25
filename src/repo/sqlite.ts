import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Effect, Layer } from "effect";
import { Repository } from "./repository.ts";
import type { DocumentPlan } from "../document/plan.ts";
import type { ReviewReport } from "../document/review.ts";
import type { SectionDraft } from "../document/draft.ts";
import type { CreateDocumentRunInput, DocumentRunRecord } from "./repository.ts";
import { FilePersistenceError } from "../error/error.ts";

export function makeLayer(path = ".document-agent/document-agent.sqlite"): Layer.Layer<Repository> {
  return Layer.effect(
    Repository,
    Effect.sync(() => {
      mkdirSync(dirname(path), { recursive: true });
      const database = new Database(path, { create: true });

      const initialize = () =>
        Effect.try({
          try: () => {
            database.exec(`
              CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                mode TEXT NOT NULL,
                status TEXT NOT NULL,
                request_json TEXT NOT NULL,
                title TEXT,
                source_path TEXT,
                output_path TEXT,
                plan_json TEXT,
                review_json TEXT,
                merged_draft TEXT,
                final_markdown TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
              );

              CREATE TABLE IF NOT EXISTS section_runs (
                document_id TEXT NOT NULL,
                section_id TEXT NOT NULL,
                title TEXT NOT NULL,
                status TEXT NOT NULL,
                markdown TEXT NOT NULL,
                word_count INTEGER NOT NULL,
                attempt INTEGER NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (document_id, section_id, attempt)
              );

              CREATE TABLE IF NOT EXISTS job_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id TEXT NOT NULL,
                level TEXT NOT NULL,
                stage TEXT NOT NULL,
                message TEXT NOT NULL,
                payload_json TEXT,
                created_at TEXT NOT NULL
              );
            `);
          },
          catch: (error) => new FilePersistenceError("SQLite 초기화 실패", error),
        });

      const createDocumentRun = (input: CreateDocumentRunInput) =>
        Effect.try({
          try: () => {
            const now = new Date().toISOString();
            database
              .query(
                `INSERT INTO documents (
                  id, mode, status, request_json, source_path, output_path, created_at, updated_at
                ) VALUES (?, ?, 'running', ?, ?, ?, ?, ?)`,
              )
              .run(
                input.documentId,
                input.mode,
                JSON.stringify(input.request),
                input.sourcePath ?? null,
                input.outputPath ?? null,
                now,
                now,
              );
          },
          catch: (error) => new FilePersistenceError("실행 레코드 생성 실패", error),
        });

      const savePlan = (documentId: string, plan: DocumentPlan) =>
        Effect.try({
          try: () => {
            updateDocument(documentId, {
              title: plan.title,
              plan_json: JSON.stringify(plan),
              updated_at: new Date().toISOString(),
            });
          },
          catch: (error) => new FilePersistenceError("계획 저장 실패", error),
        });

      const saveSectionDraft = (documentId: string, draft: SectionDraft, attempt: number) =>
        Effect.try({
          try: () => {
            database
              .query(
                `INSERT OR REPLACE INTO section_runs (
                  document_id, section_id, title, status, markdown, word_count, attempt, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .run(
                documentId,
                draft.sectionId,
                draft.title,
                draft.status,
                draft.markdown,
                draft.wordCount,
                attempt,
                new Date().toISOString(),
              );
          },
          catch: (error) => new FilePersistenceError("섹션 초안 저장 실패", error),
        });

      const saveMergedDraft = (documentId: string, markdown: string) =>
        Effect.try({
          try: () => {
            updateDocument(documentId, {
              merged_draft: markdown,
              updated_at: new Date().toISOString(),
            });
          },
          catch: (error) => new FilePersistenceError("병합 초안 저장 실패", error),
        });

      const saveReview = (documentId: string, review: ReviewReport) =>
        Effect.try({
          try: () => {
            updateDocument(documentId, {
              review_json: JSON.stringify(review),
              updated_at: new Date().toISOString(),
            });
          },
          catch: (error) => new FilePersistenceError("리뷰 저장 실패", error),
        });

      const appendLog = (
        documentId: string,
        level: "info" | "debug" | "warn" | "error",
        stage: string,
        message: string,
        payload?: Record<string, unknown>,
      ) =>
        Effect.try({
          try: () => {
            database
              .query(
                `INSERT INTO job_logs (document_id, level, stage, message, payload_json, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
              )
              .run(documentId, level, stage, message, payload ? JSON.stringify(payload) : null, new Date().toISOString());
          },
          catch: (error) => new FilePersistenceError("로그 저장 실패", error),
        });

      const completeDocument = (documentId: string, title: string, markdown: string, outputPath?: string) =>
        Effect.try({
          try: () => {
            updateDocument(documentId, {
              title,
              status: "completed",
              final_markdown: markdown,
              output_path: outputPath ?? null,
              updated_at: new Date().toISOString(),
            });
          },
          catch: (error) => new FilePersistenceError("문서 완료 저장 실패", error),
        });

      const markFailed = (documentId: string, message: string) =>
        Effect.try({
          try: () => {
            updateDocument(documentId, {
              status: "failed",
              updated_at: new Date().toISOString(),
            });
            database
              .query(
                `INSERT INTO job_logs (document_id, level, stage, message, created_at)
                 VALUES (?, ?, ?, ?, ?)`,
              )
              .run(documentId, "error", "workflow", message, new Date().toISOString());
          },
          catch: (error) => new FilePersistenceError("실패 마킹 실패", error),
        });

      const getDocumentRun = (documentId: string) =>
        Effect.try({
          try: () => {
            const row = database
              .query(
                `SELECT id, mode, status, request_json, title, output_path, source_path, plan_json, review_json, merged_draft, final_markdown
                 FROM documents WHERE id = ?`,
              )
              .get(documentId) as Record<string, string | null> | null;

            if (!row) {
              return null;
            }

            return {
              id: String(row.id),
              mode: (row.mode as "generate" | "patch") ?? "generate",
              status: String(row.status),
              requestJson: String(row.request_json),
              title: row.title ?? undefined,
              outputPath: row.output_path ?? undefined,
              sourcePath: row.source_path ?? undefined,
              planJson: row.plan_json ?? undefined,
              reviewJson: row.review_json ?? undefined,
              mergedDraft: row.merged_draft ?? undefined,
              finalMarkdown: row.final_markdown ?? undefined,
            };
          },
          catch: (error) => new FilePersistenceError("실행 레코드 조회 실패", error),
        });

      function updateDocument(documentId: string, values: Record<string, string | null>): void {
        const entries = Object.entries(values);
        const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
        const params = entries.map(([, value]) => value);
        database.query(`UPDATE documents SET ${assignments} WHERE id = ?`).run(...params, documentId);
      }

      return {
        initialize,
        createDocumentRun,
        savePlan,
        saveSectionDraft,
        saveMergedDraft,
        saveReview,
        appendLog,
        completeDocument,
        markFailed,
        getDocumentRun,
      };
    }),
  );
}
