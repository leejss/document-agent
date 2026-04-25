import { Layer } from "effect";
import { Client } from "./client.ts";
import { OpenAiCompatibleClientBase } from "./compatible.ts";

class XAiClient extends OpenAiCompatibleClientBase {
  constructor(apiKey: string, model = process.env.XAI_MODEL ?? "grok-4") {
    super({
      apiKey,
      model,
      baseURL: "https://api.x.ai/v1",
      providerLabel: "xAI",
    });
  }
}

export const layer = Layer.succeed(
  Client,
  new XAiClient(process.env.XAI_API_KEY ?? ""),
);
