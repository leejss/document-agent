import type { LlmClient } from "../ports/llm-client.ts";
import type { Logger } from "../ports/logger.ts";
import type {
  GlobalDocumentBrief,
  OutlinePlan,
} from "../../domain/types/planner.ts";
import type { SectionDraft } from "../../domain/types/section.ts";

/**
 * TODO:
 * - 서론을 outline 중심으로 쓸지, 실제 본문 draft를 반영할지 기준을 정해보기
 * - intro 섹션의 고정 템플릿이 필요한지 고민해보기
 */
export async function writeIntroduction(
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
  throw new Error("TODO: writeIntroduction 구현");
}
