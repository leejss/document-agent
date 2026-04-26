import { Args, Command, Options } from "@effect/cli";
import { Effect, Layer, Console } from "effect";
import * as Option from "effect/Option";
import { Agent } from "../agent/agent.ts";
import { layer as llmLayer } from "../llm/layer.ts";
import { layer as storeLayer } from "../store/local.ts";
import { makeLayer as makeRepoLayer } from "../repo/sqlite.ts";
import { makeLayer as makeLogLayer } from "../log/console.ts";
import { Repository } from "../repo/repository.ts";

// ─── 공통 옵션 ───
const format = Options.text("format").pipe(Options.optional);
const audience = Options.text("audience").pipe(Options.optional);
const purpose = Options.text("purpose").pipe(Options.optional);
const tone = Options.text("tone").pipe(Options.optional);
const length = Options.choice("length", [
	"short",
	"medium",
	"long",
] as const).pipe(Options.withDefault("medium"));
const parallel = Options.choice("parallel", ["auto", "off"] as const).pipe(
	Options.withDefault("auto"),
);
const output = Options.text("output").pipe(Options.optional);
const stdout = Options.boolean("stdout").pipe(Options.withDefault(false));
const verbose = Options.boolean("verbose").pipe(
	Options.withAlias("v"),
	Options.withDefault(false),
);
const requiredSection = Options.text("required-section").pipe(Options.optional);
const constraint = Options.text("constraint").pipe(Options.optional);

function parseCommaSeparated(value: string | undefined): string[] {
	if (!value) return [];
	return value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

// ─── generate 명령 ───
const promptArg = Args.text({ name: "prompt" });

const generate = Command.make(
	"doc-agent",
	{
		prompt: promptArg,
		format,
		audience,
		purpose,
		tone,
		length,
		parallel,
		output,
		stdout,
		verbose,
		requiredSection,
		constraint,
	},
	({
		prompt,
		format,
		audience,
		purpose,
		tone,
		length,
		parallel,
		output,
		stdout: stdoutFlag,
		verbose,
		requiredSection,
		constraint,
	}) =>
		Effect.gen(function* () {
			const appLayer = Agent.layer.pipe(
				Layer.provideMerge(llmLayer),
				Layer.provideMerge(storeLayer),
				Layer.provideMerge(makeRepoLayer()),
				Layer.provideMerge(makeLogLayer(verbose)),
			);

			const program = Effect.gen(function* () {
				const repo = yield* Repository;
				yield* repo.initialize();
				const agent = yield* Agent.Service;
				return yield* agent.generate({
					prompt,
					format: Option.getOrUndefined(format),
					audience: Option.getOrUndefined(audience),
					purpose: Option.getOrUndefined(purpose),
					tone: Option.getOrUndefined(tone),
					length,
					parallel,
					outputPath: Option.getOrUndefined(output),
					stdout: stdoutFlag,
					verbose,
					requiredSections: parseCommaSeparated(
						Option.getOrUndefined(requiredSection),
					),
					constraints: parseCommaSeparated(Option.getOrUndefined(constraint)),
				});
			});

			const result = yield* program.pipe(Effect.provide(appLayer));

			if (stdoutFlag || !output) {
				yield* Console.log(result.markdown);
			} else {
				yield* Console.log(`문서 생성 완료: ${output}`);
			}
		}),
);

// ─── patch 서브커맨드 ───
const pathArg = Args.text({ name: "path" });
const sectionOpt = Options.text("section");

const patch = Command.make(
	"patch",
	{
		path: pathArg,
		section: sectionOpt,
		format,
		audience,
		purpose,
		tone,
		length,
		parallel,
		output,
		stdout,
		verbose,
		requiredSection,
		constraint,
	},
	({
		path,
		section,
		format,
		audience,
		purpose,
		tone,
		length,
		parallel,
		output,
		stdout: stdoutFlag,
		verbose,
		requiredSection,
		constraint,
	}) =>
		Effect.gen(function* () {
			const appLayer = Agent.layer.pipe(
				Layer.provideMerge(llmLayer),
				Layer.provideMerge(storeLayer),
				Layer.provideMerge(makeRepoLayer()),
				Layer.provideMerge(makeLogLayer(verbose)),
			);

			const program = Effect.gen(function* () {
				const repo = yield* Repository;
				yield* repo.initialize();
				const agent = yield* Agent.Service;
				return yield* agent.patch(path, section, {
					format: Option.getOrUndefined(format),
					audience: Option.getOrUndefined(audience),
					purpose: Option.getOrUndefined(purpose),
					tone: Option.getOrUndefined(tone),
					length,
					parallel,
					outputPath: Option.getOrUndefined(output),
					stdout: stdoutFlag,
					verbose,
					requiredSections: parseCommaSeparated(
						Option.getOrUndefined(requiredSection),
					),
					constraints: parseCommaSeparated(Option.getOrUndefined(constraint)),
				});
			});

			const result = yield* program.pipe(Effect.provide(appLayer));

			if (stdoutFlag) {
				yield* Console.log(result.markdown);
			} else {
				yield* Console.log(`패치 완료: ${result.outputPath}`);
			}
		}),
);

export const app = generate.pipe(Command.withSubcommands([patch]));
