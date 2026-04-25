import { Effect, Layer } from "effect";
import { Agent } from "../../agent/agent.ts";
import { layer as llmLayer } from "../../llm/layer.ts";
import { layer as storeLayer } from "../../store/local.ts";
import { makeLayer as makeRepoLayer } from "../../repo/sqlite.ts";
import { makeLayer as makeLogLayer } from "../../log/console.ts";
import { Repository } from "../../repo/repository.ts";
import type { PatchCommand } from "../parser.ts";

export async function handle(command: PatchCommand): Promise<void> {
  const appLayer = Agent.layer.pipe(
    Layer.provideMerge(llmLayer),
    Layer.provideMerge(storeLayer),
    Layer.provideMerge(makeRepoLayer()),
    Layer.provideMerge(makeLogLayer(command.request.verbose)),
  );

  const program = Effect.gen(function* () {
    const repo = yield* Repository;
    yield* repo.initialize();
    const agent = yield* Agent.Service;
    return yield* agent.patch(command.path, command.sectionTitle, command.request);
  });

  const result = await Effect.runPromise(program.pipe(Effect.provide(appLayer)));

  if (command.request.stdout) {
    console.log(result.markdown);
  } else {
    console.log(`패치 완료: ${result.outputPath}`);
  }
}
