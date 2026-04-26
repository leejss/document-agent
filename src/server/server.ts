import { Effect, Layer } from "effect";
import { Agent } from "../agent/agent.ts";
import type { DocumentRequest } from "../document/request.ts";
import { layer as llmLayer } from "../llm/layer.ts";
import { makeLayer as makeLogLayer } from "../log/console.ts";
import { Repository } from "../repo/repository.ts";
import { makeLayer as makeRepoLayer } from "../repo/sqlite.ts";
import { layer as storeLayer } from "../store/local.ts";

const appLayer = Agent.layer.pipe(
	Layer.provideMerge(llmLayer),
	Layer.provideMerge(storeLayer),
	Layer.provideMerge(makeRepoLayer()),
	Layer.provideMerge(makeLogLayer(false)),
);

async function initRepo(): Promise<void> {
	const program = Effect.gen(function* () {
		const repo = yield* Repository;
		yield* repo.initialize();
	});
	await Effect.runPromise(program.pipe(Effect.provide(appLayer)));
}

export async function start(port = 3000, hostname = "0.0.0.0"): Promise<void> {
	await initRepo();

	Bun.serve({
		port,
		hostname,
		routes: {
			"/generate": {
				POST: async (req) => {
					try {
						const body = (await req.json()) as DocumentRequest;
						const program = Effect.gen(function* () {
							const agent = yield* Agent.Service;
							return yield* agent.generate(body);
						});
						const result = await Effect.runPromise(
							program.pipe(Effect.provide(appLayer)),
						);
						return Response.json(result);
					} catch (error) {
						return Response.json(
							{
								error: error instanceof Error ? error.message : "Unknown error",
							},
							{ status: 500 },
						);
					}
				},
			},
			"/patch": {
				POST: async (req) => {
					try {
						const body = (await req.json()) as {
							path: string;
							sectionTitle: string;
							request: Partial<DocumentRequest> & {
								verbose: boolean;
								stdout: boolean;
								outputPath?: string;
							};
						};
						const program = Effect.gen(function* () {
							const agent = yield* Agent.Service;
							return yield* agent.patch(
								body.path,
								body.sectionTitle,
								body.request,
							);
						});
						const result = await Effect.runPromise(
							program.pipe(Effect.provide(appLayer)),
						);
						return Response.json(result);
					} catch (error) {
						return Response.json(
							{
								error: error instanceof Error ? error.message : "Unknown error",
							},
							{ status: 500 },
						);
					}
				},
			},
		},
	});

	console.log(`document-agent server listening on http://${hostname}:${port}`);
}
