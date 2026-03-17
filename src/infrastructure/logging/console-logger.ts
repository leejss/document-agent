import type { Logger } from "../../application/ports/logger.ts";
import type { LogLevel } from "../../domain/document.ts";

export class ConsoleLogger implements Logger {
  constructor(private readonly verbose: boolean) {}

  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (level === "debug" && !this.verbose) {
      return;
    }

    const payload = context ? ` ${JSON.stringify(context)}` : "";
    const line = `${prefix(level)} ${message}${payload}`;
    if (level === "error") {
      console.error(line);
      return;
    }
    console.log(line);
  }
}

function prefix(level: LogLevel): string {
  switch (level) {
    case "debug":
      return "[debug]";
    case "warn":
      return "[warn]";
    case "error":
      return "[error]";
    case "info":
    default:
      return "[info]";
  }
}
