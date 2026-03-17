import type {
  LlmClient,
  LlmStructuredGenerationParams,
  LlmTextGenerationParams,
} from "../../application/ports/llm-client.ts";

/**
 * 실제 벤더 연결은 나중 단계에서 구현한다.
 *
 * TODO:
 * - 어떤 모델/응답 포맷을 사용할지 결정해보기
 * - 구조화 출력 실패 시 재시도 정책을 어떻게 둘지 고민해보기
 */
export class OpenAiLlmClient implements LlmClient {
  async generateText(_params: LlmTextGenerationParams): Promise<string> {
    throw new Error("TODO: OpenAiLlmClient.generateText 구현");
  }

  async generateStructured<T>(
    _params: LlmStructuredGenerationParams<string>,
  ): Promise<T> {
    throw new Error("TODO: OpenAiLlmClient.generateStructured 구현");
  }
}
