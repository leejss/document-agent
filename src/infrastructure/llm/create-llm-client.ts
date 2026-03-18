import type { LlmClient } from "../../application/ports/llm-client.ts";
import { ExternalDependencyError } from "../../domain/errors.ts";
import { AnthropicLlmClient } from "../anthropic/anthropic-llm-client.ts";
import { OpenAiLlmClient } from "../openai/openai-llm-client.ts";
import { XAiLlmClient } from "../xai/xai-llm-client.ts";

export type LlmProvider = "openai" | "xai" | "anthropic";

export function createLlmClient(): LlmClient {
  const provider = resolveProvider();

  switch (provider) {
    case "openai":
      if (!process.env.OPENAI_API_KEY) {
        throw new ExternalDependencyError("OPENAI_API_KEY 가 설정되어 있지 않습니다.");
      }
      return new OpenAiLlmClient(process.env.OPENAI_API_KEY, process.env.OPENAI_MODEL ?? "gpt-5.2");
    case "xai":
      if (!process.env.XAI_API_KEY) {
        throw new ExternalDependencyError("XAI_API_KEY 가 설정되어 있지 않습니다.");
      }
      return new XAiLlmClient(process.env.XAI_API_KEY, process.env.XAI_MODEL ?? "grok-4-1-fast-reasoning");
    case "anthropic":
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new ExternalDependencyError("ANTHROPIC_API_KEY 가 설정되어 있지 않습니다.");
      }
      return new AnthropicLlmClient(
        process.env.ANTHROPIC_API_KEY,
        process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
      );
  }
}

export function resolveProvider(value = process.env.LLM_PROVIDER): LlmProvider {
  const normalized = value?.trim().toLowerCase() ?? "openai";

  if (normalized === "openai" || normalized === "xai" || normalized === "anthropic") {
    return normalized;
  }

  throw new ExternalDependencyError(
    `지원하지 않는 LLM_PROVIDER 입니다: ${value}. 사용 가능 값은 openai, xai, anthropic 입니다.`,
  );
}
