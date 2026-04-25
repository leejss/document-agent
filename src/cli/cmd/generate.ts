import { Effect, Layer } from "effect";
import { Agent } from "../../agent/agent.ts";
import { layer as llmLayer } from "../../llm/layer.ts";
import { layer as storeLayer } from "../../store/local.ts";
import { makeLayer as makeRepoLayer } from "../../repo/sqlite.ts";
import { makeLayer as makeLogLayer } from "../../log/console.ts";
import { Repository } from "../../repo/repository.ts";
import type { GenerateCommand } from "../parser.ts";

export async function handle(command: GenerateCommand): Promise<void> {
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
    return yield* agent.generate(command.request);
  });

  const result = await Effect.runPromise(program.pipe(Effect.provide(appLayer)));

  if (command.request.stdout || !command.request.outputPath) {
    console.log(result.markdown);
  } else {
    console.log(`문서 생성 완료: ${result.outputPath}`);
  }
}
