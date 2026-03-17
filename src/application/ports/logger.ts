import type { LogLevel } from "../../domain/document.ts";

export interface Logger {
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void;
}
