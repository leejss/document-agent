import type { LlmClient } from "../ports/llm-client.ts";
import type { Logger } from "../ports/logger.ts";
import type { GeneratedDocumentResult } from "../../domain/types/document.ts";
import type { CreateDocumentRequest } from "../../domain/types/request.ts";

/**
 * 이 모듈은 문서 생성의 제어 흐름만 책임진다.
 *
 * TODO:
 * - 각 단계 실패 시 중단/재시도/부분 성공 중 어떤 정책을 쓸지 정의해보기
 * - 병렬 실행 결과를 어떤 순서로 다시 합칠지 결정해보기
 * - patch를 기본 1회로 둘지 reviewer 결과에 따라 건너뛸지 설계해보기
 */
export async function generateDocument(
  _request: CreateDocumentRequest,
  _deps: {
    llm: LlmClient;
    logger: Logger;
  },
): Promise<GeneratedDocumentResult> {
  throw new Error("TODO: generateDocument 구현");
}
