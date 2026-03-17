import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  CreateDocumentRunInput,
  DocumentRunRecord,
  DocumentRunRepository,
} from "../../application/ports/document-run-repository.ts";
import type { DocumentPlan, ReviewReport, SectionDraft } from "../../domain/document.ts";

export class SqliteDocumentRunRepository implements DocumentRunRepository {
  private readonly database: Database;

  constructor(path = ".document-agent/document-agent.sqlite") {
    mkdirSync(dirname(path), { recursive: true });
    this.database = new Database(path, { create: true });
  }

  initialize(): void {
    this.database.exec(`
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
  }

  createDocumentRun(input: CreateDocumentRunInput): void {
    const now = new Date().toISOString();
    this.database
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
  }

  savePlan(documentId: string, plan: DocumentPlan): void {
    this.updateDocument(documentId, {
      title: plan.title,
      plan_json: JSON.stringify(plan),
      updated_at: new Date().toISOString(),
    });
  }

  saveSectionDraft(documentId: string, draft: SectionDraft, attempt: number): void {
    this.database
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
  }

  saveMergedDraft(documentId: string, markdown: string): void {
    this.updateDocument(documentId, {
      merged_draft: markdown,
      updated_at: new Date().toISOString(),
    });
  }

  saveReview(documentId: string, review: ReviewReport): void {
    this.updateDocument(documentId, {
      review_json: JSON.stringify(review),
      updated_at: new Date().toISOString(),
    });
  }

  appendLog(
    documentId: string,
    level: "info" | "debug" | "warn" | "error",
    stage: string,
    message: string,
    payload?: Record<string, unknown>,
  ): void {
    this.database
      .query(
        `INSERT INTO job_logs (document_id, level, stage, message, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(documentId, level, stage, message, payload ? JSON.stringify(payload) : null, new Date().toISOString());
  }

  completeDocument(documentId: string, title: string, markdown: string, outputPath?: string): void {
    this.updateDocument(documentId, {
      title,
      status: "completed",
      final_markdown: markdown,
      output_path: outputPath ?? null,
      updated_at: new Date().toISOString(),
    });
  }

  markFailed(documentId: string, message: string): void {
    this.updateDocument(documentId, {
      status: "failed",
      updated_at: new Date().toISOString(),
    });
    this.appendLog(documentId, "error", "workflow", message);
  }

  getDocumentRun(documentId: string): DocumentRunRecord | null {
    const row = this.database
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
  }

  private updateDocument(documentId: string, values: Record<string, string | null>): void {
    const entries = Object.entries(values);
    const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
    const params = entries.map(([, value]) => value);
    this.database.query(`UPDATE documents SET ${assignments} WHERE id = ?`).run(...params, documentId);
  }
}
