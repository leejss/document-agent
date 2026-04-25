#!/usr/bin/env bun

import { parseArgv } from "./parser.ts";
import { handle as handleGenerate } from "./cmd/generate.ts";
import { handle as handlePatch } from "./cmd/patch.ts";
import { AppError } from "../error/error.ts";
import { UI } from "./ui.ts";

async function main(argv = Bun.argv.slice(2)): Promise<number> {
  const command = parseArgv(argv);

  if (command.kind === "generate") {
    await handleGenerate(command);
    return 0;
  }

  await handlePatch(command);
  return 0;
}

if (import.meta.main) {
  main().then(
    (code) => process.exit(code),
    (error: unknown) => {
      const resolved = normalizeError(error);
      UI.error(formatError(resolved));
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

function formatError(error: unknown, depth = 0): string {
  const indent = "  ".repeat(depth);
  if (error instanceof AppError && error.cause) {
    return `${indent}${error.message}\n${formatError(error.cause, depth + 1)}`;
  }
  if (error instanceof Error) {
    return `${indent}${error.message}`;
  }
  return `${indent}${String(error)}`;
}
