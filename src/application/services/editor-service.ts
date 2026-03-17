import type { LlmClient } from "../ports/llm-client.ts";
import type { Logger } from "../ports/logger.ts";
import type {
  GlobalDocumentBrief,
  OutlinePlan,
} from "../../domain/types/planner.ts";
import type { SectionDraft } from "../../domain/types/section.ts";

/**
 * Editor의 목표는 압축이 아니라 통합이다.
 *
 * TODO:
 * - 섹션 병합 순서를 outline 단위로 엄격히 따를지 고민해보기
 * - 용어 통일을 editor에 둘지 별도 normalizer로 뺄지 검토해보기
 * - 길이 후퇴(length regression)를 어떻게 검증할지 생각해보기
 */
export async function editDocument(
  _input: {
    globalBrief: GlobalDocumentBrief;
    outline: OutlinePlan;
    sectionDrafts: SectionDraft[];
  },
  _deps: {
    llm: LlmClient;
    logger: Logger;
  },
): Promise<string> {
  throw new Error("TODO: editDocument 구현");
}
