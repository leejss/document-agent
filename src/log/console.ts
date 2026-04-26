import { Effect, Layer } from "effect";
import type { LogLevel } from "../document/request.ts";
import { Logger } from "./logger.ts";

export function makeLayer(verbose: boolean): Layer.Layer<Logger> {
	return Layer.succeed(Logger, {
		log: (
			level: LogLevel,
			message: string,
			context?: Record<string, unknown>,
		): Effect.Effect<void> =>
			Effect.sync(() => {
				if (level === "debug" && !verbose) {
					return;
				}

				const payload = context ? ` ${JSON.stringify(context)}` : "";
				const line = `${prefix(level)} ${message}${payload}`;
				if (level === "error") {
					console.error(line);
					return;
				}
				console.log(line);
			}),
	});
}

function prefix(level: LogLevel): string {
	switch (level) {
		case "debug":
			return "[debug]";
		case "warn":
			return "[warn]";
		case "error":
			return "[error]";
		default:
			return "[info]";
	}
}
