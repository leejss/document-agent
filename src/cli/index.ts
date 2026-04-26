#!/usr/bin/env bun

import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { AppError } from "../error/error.ts";
import { app } from "./commands.ts";

const cli = Command.run(app, {
	name: "document-agent",
	version: "1.0.0",
});

cli(process.argv).pipe(
	Effect.catchAll((error) => {
		const formatted = formatError(error);
		return Console.error(formatted);
	}),
	Effect.provide(NodeContext.layer),
	NodeRuntime.runMain,
);

function formatError(error: unknown): string {
	if (error instanceof AppError && error.cause) {
		return `${error.message}\n  cause: ${error.cause instanceof Error ? error.cause.message : String(error.cause)}`;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}
