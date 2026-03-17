import type { LlmClient } from "../ports/llm-client.ts";
import type { Logger } from "../ports/logger.ts";
import type {
  GlobalDocumentBrief,
  OutlinePlan,
} from "../../domain/types/planner.ts";
import type { SectionDraft } from "../../domain/types/section.ts";

/**
 * TODO:
 * - 결론이 단순 요약이 아니라 독자 행동 유도/다음 단계 제안까지 포함할지 생각해보기
 * - patch 이후 결론을 다시 써야 하는 조건을 정의해보기
 */
export async function writeConclusion(
  _input: {
    globalBrief: GlobalDocumentBrief;
    outline: OutlinePlan;
    sectionDrafts: SectionDraft[];
  },
  _deps: {
    llm: LlmClient;
    logger: Logger;
  },
): Promise<SectionDraft> {
  throw new Error("TODO: writeConclusion 구현");
}
