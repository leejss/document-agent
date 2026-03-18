#!/usr/bin/env bun

import { parseArgv } from "./application/services/cli-parser.ts";
import { DocumentAgent } from "./application/services/document-agent.ts";
import { AppError } from "./domain/errors.ts";
import { MarkdownStore } from "./infrastructure/fs/markdown-store.ts";
import { createLlmClient } from "./infrastructure/llm/create-llm-client.ts";
import { ConsoleLogger } from "./infrastructure/logging/console-logger.ts";
import { SqliteDocumentRunRepository } from "./infrastructure/persistence/sqlite-document-run-repository.ts";

export * from "./application/ports/document-run-repository.ts";
export * from "./application/ports/llm-client.ts";
export * from "./application/ports/logger.ts";
export * from "./application/services/cli-parser.ts";
export * from "./application/services/document-agent.ts";
export * from "./application/services/scheduler.ts";
export * from "./domain/document.ts";
export * from "./domain/errors.ts";
export * from "./infrastructure/anthropic/anthropic-llm-client.ts";
export * from "./infrastructure/fs/markdown-store.ts";
export * from "./infrastructure/llm/create-llm-client.ts";
export * from "./infrastructure/llm/document-prompt-factory.ts";
export * from "./infrastructure/llm/document-schemas.ts";
export * from "./infrastructure/logging/console-logger.ts";
export * from "./infrastructure/openai/openai-llm-client.ts";
export * from "./infrastructure/persistence/sqlite-document-run-repository.ts";
export * from "./infrastructure/xai/xai-llm-client.ts";

async function main(argv = Bun.argv.slice(2)): Promise<number> {
  const command = parseArgv(argv);
  const logger = new ConsoleLogger(command.request.verbose);
  const repository = new SqliteDocumentRunRepository();
  repository.initialize();
  const markdownStore = new MarkdownStore();

  const llm = createLlmClient();
  const service = new DocumentAgent(llm, repository, logger, markdownStore);

  if (command.kind === "generate") {
    const result = await service.generate(command.request);
    if (command.request.stdout || !command.request.outputPath) {
      console.log(result.markdown);
    } else {
      console.log(`문서 생성 완료: ${result.outputPath}`);
    }
    return 0;
  }

  const result = await service.patchDocument(command.path, command.sectionTitle, command.request);
  if (command.request.stdout) {
    console.log(result.markdown);
  } else {
    console.log(`패치 완료: ${result.outputPath}`);
  }
  return 0;
}

if (import.meta.main) {
  main().then(
    (code) => process.exit(code),
    (error: unknown) => {
      const resolved = normalizeError(error);
      console.error(resolved.message);
      process.exit(resolved.exitCode);
    },
  );
}

function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof Error) {
    return new AppError(error.message, 1, error);
  }
  return new AppError("알 수 없는 오류가 발생했습니다.", 1, error);
}
