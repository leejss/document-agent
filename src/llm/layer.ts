import type { Layer } from "effect";
import { ExternalDependencyError } from "../error/error.ts";
import * as Anthropic from "./anthropic.ts";
import type { Client } from "./client.ts";
import * as OpenAi from "./openai.ts";
import * as XAi from "./xai.ts";

export type LlmProvider = "openai" | "xai" | "anthropic";

export function resolveProvider(value = process.env.LLM_PROVIDER): LlmProvider {
	const normalized = value?.trim().toLowerCase() ?? "openai";

	if (
		normalized === "openai" ||
		normalized === "xai" ||
		normalized === "anthropic"
	) {
		return normalized;
	}

	throw new ExternalDependencyError(
		`지원하지 않는 LLM_PROVIDER 입니다: ${value}. 사용 가능 값은 openai, xai, anthropic 입니다.`,
	);
}

export function validateEnv(provider: LlmProvider): void {
	switch (provider) {
		case "openai":
			if (!process.env.OPENAI_API_KEY) {
				throw new ExternalDependencyError(
					"OPENAI_API_KEY 가 설정되어 있지 않습니다.",
				);
			}
			break;
		case "xai":
			if (!process.env.XAI_API_KEY) {
				throw new ExternalDependencyError(
					"XAI_API_KEY 가 설정되어 있지 않습니다.",
				);
			}
			break;
		case "anthropic":
			if (!process.env.ANTHROPIC_API_KEY) {
				throw new ExternalDependencyError(
					"ANTHROPIC_API_KEY 가 설정되어 있지 않습니다.",
				);
			}
			break;
	}
}

export const layer: Layer.Layer<Client> = (() => {
	const provider = resolveProvider();
	validateEnv(provider);

	switch (provider) {
		case "openai":
			return OpenAi.layer;
		case "xai":
			return XAi.layer;
		case "anthropic":
			return Anthropic.layer;
	}
})();
