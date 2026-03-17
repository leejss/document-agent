import type { LlmClient } from "../ports/llm-client.ts";
import type { Logger } from "../ports/logger.ts";
import type {
  GlobalDocumentBrief,
  OutlinePlan,
} from "../../domain/types/planner.ts";
import type { ReviewResult } from "../../domain/types/review.ts";

/**
 * Reviewer는 판정기가 아니라 진단기다.
 *
 * TODO:
 * - 체크리스트를 정적 규칙과 LLM 평가 중 어디까지 분리할지 고민해보기
 * - weakSections의 severity 기준을 어떻게 계산할지 정의해보기
 * - reviewer score를 제품 KPI와 직접 연결할지 생각해보기
 */
export async function reviewDocument(
  _input: {
    globalBrief: GlobalDocumentBrief;
    outline: OutlinePlan;
    document: string;
  },
  _deps: {
    llm: LlmClient;
    logger: Logger;
  },
): Promise<ReviewResult> {
  throw new Error("TODO: reviewDocument 구현");
}
