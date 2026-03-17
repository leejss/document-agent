import type { LlmClient } from "../ports/llm-client.ts";
import type { Logger } from "../ports/logger.ts";
import type {
  GlobalDocumentBrief,
  SectionBrief,
} from "../../domain/types/planner.ts";
import type { PatchRequest, PatchResult } from "../../domain/types/review.ts";
import type { SectionDraft } from "../../domain/types/section.ts";

/**
 * TODO:
 * - 전체 재생성과 부분 수정을 어떻게 구분할지 설계해보기
 * - 패치 후 editor/reviewer 재호출 기준을 어디에 둘지 생각해보기
 * - 한 섹션에 여러 패치 요청이 들어오면 어떻게 병합할지 고민해보기
 */
export async function patchSection(
  _input: {
    globalBrief: GlobalDocumentBrief;
    sectionBrief: SectionBrief;
    currentDraft: SectionDraft;
    patchRequest: PatchRequest;
  },
  _deps: {
    llm: LlmClient;
    logger: Logger;
  },
): Promise<PatchResult> {
  throw new Error("TODO: patchSection 구현");
}
