import type { LlmClient } from "../ports/llm-client.ts";
import type { Logger } from "../ports/logger.ts";
import type {
  GlobalDocumentBrief,
  SectionBrief,
} from "../../domain/types/planner.ts";
import type { SectionDraft } from "../../domain/types/section.ts";

/**
 * Section writer는 "좋은 문장"보다 "계약을 만족하는 섹션"을 먼저 만들어야 한다.
 *
 * TODO:
 * - minWordCount를 프롬프트로만 강제할지 후처리 검증도 할지 결정해보기
 * - relatedSections를 얼마나 전달해야 중복을 줄이면서도 컨텍스트 과부하를 막을지 고민해보기
 * - 실패 재시도 시 어떤 입력을 그대로 재사용할지 정의해보기
 */
export async function writeSectionDraft(
  _input: {
    globalBrief: GlobalDocumentBrief;
    sectionBrief: SectionBrief;
    relatedSections?: Array<Pick<SectionDraft, "sectionId" | "content">>;
  },
  _deps: {
    llm: LlmClient;
    logger: Logger;
  },
): Promise<SectionDraft> {
  throw new Error("TODO: writeSectionDraft 구현");
}
