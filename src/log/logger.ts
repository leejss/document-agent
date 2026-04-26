import { Context, type Effect } from "effect";
import type { LogLevel } from "../document/request.ts";

export interface Interface {
	readonly log: (
		level: LogLevel,
		message: string,
		context?: Record<string, unknown>,
	) => Effect.Effect<void>;
}

export class Logger extends Context.Tag("Logger")<Logger, Interface>() {}
