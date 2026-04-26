import { Layer } from "effect";
import { Client } from "./client.ts";
import { OpenAiCompatibleClientBase } from "./compatible.ts";

class OpenAiClient extends OpenAiCompatibleClientBase {
	constructor(apiKey: string, model = process.env.OPENAI_MODEL ?? "gpt-5.2") {
		super({
			apiKey,
			model,
			providerLabel: "OpenAI",
		});
	}
}

export const layer = Layer.succeed(
	Client,
	new OpenAiClient(process.env.OPENAI_API_KEY ?? ""),
);
