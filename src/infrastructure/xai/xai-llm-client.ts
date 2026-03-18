import { OpenAiCompatibleLlmClientBase } from "../llm/openai-compatible-llm-client-base.ts";

export class XAiLlmClient extends OpenAiCompatibleLlmClientBase {
  constructor(apiKey: string, model = process.env.XAI_MODEL ?? "grok-4") {
    super({
      apiKey,
      model,
      baseURL: "https://api.x.ai/v1",
      providerLabel: "xAI",
    });
  }
}
