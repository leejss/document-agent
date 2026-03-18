import { OpenAiCompatibleLlmClientBase } from "../llm/openai-compatible-llm-client-base.ts";

export class OpenAiLlmClient extends OpenAiCompatibleLlmClientBase {
  constructor(apiKey: string, model = process.env.OPENAI_MODEL ?? "gpt-5.2") {
    super({
      apiKey,
      model,
      providerLabel: "OpenAI",
    });
  }
}
