# 구현 가이드 4: 섹션 작성과 문서 통합을 구현하기

## 1. 이 문서의 역할

이 문서는 4권이다.

이제 처음으로 “실제 문서 내용”에 가까운 부분을 구현한다. 하지만 여전히 초점은 멋진 문장을 쓰는 것이 아니라, **계획을 본문으로 옮기는 규칙**을 구현하는 데 있다.

이번 권에서 다루는 축은 세 가지다.

1. 섹션 초안 작성
2. 서론/결론 생성
3. 전체 문서 편집과 통합

### 💡 왜 "집필"과 "편집"을 분리하는가? (Why?)
한 번의 LLM 호출로 완벽한 글을 쓰기는 불가능하다.
- **관점의 분리**: 집필(Writer)은 **내용의 풍성함**에 집중하고, 편집(Editor)은 **문장력과 톤의 일관성**에 집중한다. 한 번에 하려 하면 둘 다 놓친다.
- **품질의 점진적 개선**: 거친 초안을 먼저 뽑고, 이를 다듬는 단계적인 접근이 최종 품질을 드라마틱하게 높인다.

### 🚀 집필된 결과의 미래 역할 (Role)
- **최종본의 씨앗**: `SectionDraft`는 아직 다듬어지지 않았지만 문서의 핵심 가치를 담고 있다.
- **검토의 대상**: 이 단계에서 만들어진 결과물은 5권에서 `Reviewer`가 난도질(?)을 하며 품질을 극한까지 끌어올리는 대상이 된다.

---

## 2. 이번 권에서 다룰 파일

- [`src/application/services/section-writer-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/section-writer-service.ts)
- [`src/application/services/intro-writer-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/intro-writer-service.ts)
- [`src/application/services/conclusion-writer-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/conclusion-writer-service.ts)
- [`src/application/services/editor-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/editor-service.ts)
- [`src/agents/prompts/section-writer.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/section-writer.ts)
- [`src/agents/prompts/editor.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/editor.ts)

필요하면 함께 다시 볼 파일:

- [`src/domain/types/planner.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/planner.ts)
- [`src/domain/types/section.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/section.ts)

---

## 3. 먼저 이해할 개념

이번 권의 핵심은 “계획을 본문으로 바꾸되, 각 단계 책임을 섞지 않는 것”이다.

각 서비스의 역할은 이렇게 다르다.

- section writer
  - 섹션 하나를 작성한다.
- intro writer
  - 전체 문서의 시작을 잡는다.
- conclusion writer
  - 전체 문서의 마무리를 만든다.
- editor
  - 여러 조각을 하나의 문서처럼 읽히게 만든다.

이 차이를 먼저 분명히 느끼고 타이핑해야 한다.

---

## 4. 직접 타이핑 순서

### 4.1 `section-writer-service.ts`

가장 먼저 section writer를 친다.

이유:

- 본문 초안은 이 시스템의 가장 기본 산출물이다.
- intro/conclusion/editor도 결국 section writer 결과를 전제로 움직인다.

집중할 것:

- `GlobalDocumentBrief`와 `SectionBrief`를 어떻게 함께 활용할지
- `requiredElements`를 어떻게 실제 본문 유도에 반영할지
- `relatedSections`를 어떻게 전달해 중복을 줄일지
- `minWordCount`를 프롬프트와 후처리 중 어디서 보장할지

직접 답할 질문:

- 섹션 글쓰기의 품질 기준은 “문장이 예쁜가”보다 “계약을 지켰는가”가 맞는가?
- 섹션 실패 시 retry 입력은 무엇을 재사용해야 하는가?

직접 타이핑 코드:

```ts
// src/application/services/section-writer-service.ts
import type { LlmClient } from "../ports/llm-client.ts";
import type { Logger } from "../ports/logger.ts";
import type {
  GlobalDocumentBrief,
  SectionBrief,
} from "../../domain/types/planner.ts";
import type { SectionDraft } from "../../domain/types/section.ts";
import { countWords } from "../../shared/utils/text.ts";
import { SECTION_WRITER_SYSTEM_PROMPT } from "../../agents/prompts/section-writer.ts";

export async function writeSectionDraft(
  input: {
    globalBrief: GlobalDocumentBrief;
    sectionBrief: SectionBrief;
    relatedSections?: Array<Pick<SectionDraft, "sectionId" | "content">>;
  },
  deps: {
    llm: LlmClient;
    logger: Logger;
  },
): Promise<SectionDraft> {
  deps.logger.info("section draft 작성 시작", {
    sectionId: input.sectionBrief.id,
  });

  const content = await deps.llm.generateText({
    systemPrompt: SECTION_WRITER_SYSTEM_PROMPT,
    userPrompt: JSON.stringify(input),
  });

  const now = new Date().toISOString();

  return {
    sectionId: input.sectionBrief.id,
    content,
    status: "draft",
    wordCount: countWords(content),
    createdAt: now,
    updatedAt: now,
  };
}
```

### 4.2 `section-writer.ts` 프롬프트

이제 section writer 프롬프트를 친다.

중요한 점:

- planner가 설계한 brief를 글쓰기 지시로 번역하는 파일이다.
- 프롬프트가 길어지는 것보다, 요구사항이 구조적으로 명확한 것이 더 중요하다.

생각할 것:

- 설명, 예시, 비교, 코드, 체크리스트 같은 요소를 어떤 형태로 지시할까?
- 중복 금지를 어떻게 자연스럽게 전달할까?

직접 타이핑 코드:

```ts
// src/agents/prompts/section-writer.ts
export const SECTION_WRITER_SYSTEM_PROMPT = `
당신은 문서의 단일 섹션을 작성하는 writer다.

반드시 지켜야 할 규칙:
- section brief의 purpose를 중심으로 작성한다.
- keyPoints를 빠짐없이 반영한다.
- requiredElements를 가능한 본문 안에 자연스럽게 포함한다.
- 다른 섹션과 중복되는 설명은 피한다.
- 요약만 하지 말고 충분한 설명 깊이를 제공한다.
`.trim();
```

### 4.3 `intro-writer-service.ts`와 `conclusion-writer-service.ts`

다음으로 서론/결론 작성기를 친다.

집중할 것:

- 서론은 문서 진입을 돕는다.
- 결론은 단순 요약이 아니라 정리와 다음 행동을 도울 수 있다.

생각할 것:

- 서론은 outline 중심인가, body draft 중심인가?
- patch 이후 결론을 다시 써야 할까?

직접 타이핑 코드:

```ts
// src/application/services/intro-writer-service.ts
import type { LlmClient } from "../ports/llm-client.ts";
import type { Logger } from "../ports/logger.ts";
import type {
  GlobalDocumentBrief,
  OutlinePlan,
} from "../../domain/types/planner.ts";
import type { SectionDraft } from "../../domain/types/section.ts";
import { countWords } from "../../shared/utils/text.ts";

export async function writeIntroduction(
  input: {
    globalBrief: GlobalDocumentBrief;
    outline: OutlinePlan;
    sectionDrafts: SectionDraft[];
  },
  deps: {
    llm: LlmClient;
    logger: Logger;
  },
): Promise<SectionDraft> {
  const content = await deps.llm.generateText({
    systemPrompt: "당신은 문서의 서론을 작성한다.",
    userPrompt: JSON.stringify(input),
  });

  const now = new Date().toISOString();

  return {
    sectionId: "introduction",
    content,
    status: "draft",
    wordCount: countWords(content),
    createdAt: now,
    updatedAt: now,
  };
}
```

```ts
// src/application/services/conclusion-writer-service.ts
import type { LlmClient } from "../ports/llm-client.ts";
import type { Logger } from "../ports/logger.ts";
import type {
  GlobalDocumentBrief,
  OutlinePlan,
} from "../../domain/types/planner.ts";
import type { SectionDraft } from "../../domain/types/section.ts";
import { countWords } from "../../shared/utils/text.ts";

export async function writeConclusion(
  input: {
    globalBrief: GlobalDocumentBrief;
    outline: OutlinePlan;
    sectionDrafts: SectionDraft[];
  },
  deps: {
    llm: LlmClient;
    logger: Logger;
  },
): Promise<SectionDraft> {
  const content = await deps.llm.generateText({
    systemPrompt: "당신은 문서의 결론을 작성한다.",
    userPrompt: JSON.stringify(input),
  });

  const now = new Date().toISOString();

  return {
    sectionId: "conclusion",
    content,
    status: "draft",
    wordCount: countWords(content),
    createdAt: now,
    updatedAt: now,
  };
}
```

### 4.4 `editor-service.ts`

마지막으로 editor를 친다.

집중할 것:

- 병렬로 작성된 초안을 한 사람의 글처럼 연결하는 것
- 용어 통일, 중복 제거, 연결 문장 보강
- 길이를 과도하게 줄이지 않는 것

직접 답할 질문:

- editor가 구조까지 바꿔도 되는가?
- glossary와 styleGuide는 여기서 어떻게 쓰이는가?
- 중복 제거와 정보 보존의 균형은 어떻게 잡을까?

직접 타이핑 코드:

```ts
// src/application/services/editor-service.ts
import type { LlmClient } from "../ports/llm-client.ts";
import type { Logger } from "../ports/logger.ts";
import type {
  GlobalDocumentBrief,
  OutlinePlan,
} from "../../domain/types/planner.ts";
import type { SectionDraft } from "../../domain/types/section.ts";
import { EDITOR_SYSTEM_PROMPT } from "../../agents/prompts/editor.ts";

export async function editDocument(
  input: {
    globalBrief: GlobalDocumentBrief;
    outline: OutlinePlan;
    sectionDrafts: SectionDraft[];
  },
  deps: {
    llm: LlmClient;
    logger: Logger;
  },
): Promise<string> {
  deps.logger.info("editor 시작", {
    sectionCount: input.sectionDrafts.length,
  });

  return deps.llm.generateText({
    systemPrompt: EDITOR_SYSTEM_PROMPT,
    userPrompt: JSON.stringify(input),
  });
}
```

```ts
// src/agents/prompts/editor.ts
export const EDITOR_SYSTEM_PROMPT = `
당신은 여러 섹션 초안을 하나의 문서로 통합하는 editor다.

반드시 지켜야 할 규칙:
- 용어를 일관되게 맞춘다.
- 중복을 줄이되 정보량을 과하게 줄이지 않는다.
- 서론, 본문, 결론이 자연스럽게 연결되도록 다듬는다.
- 전역 style guide를 따른다.
`.trim();
```

---

## 5. 구현 포인트

이번 권에서 흔히 생기는 실수는 아래와 같다.

- section writer가 editor 역할까지 해버리는 것
- intro/conclusion을 일반 섹션과 완전히 같게 다루는 것
- editor가 문서를 지나치게 압축하는 것

항상 기억할 점:

- section writer는 “개별 섹션 품질”
- editor는 “전역 문서 일관성”

둘은 비슷해 보여도 책임이 다르다.

---

## 6. 직접 타이핑할 때 추천 루틴

1. 먼저 `SectionBrief` 하나를 예시로 적는다.
2. 이 brief를 보고 어떤 본문이 나와야 하는지 상상한다.
3. 그 상상을 section writer 인터페이스에 맞춰 구현한다.
4. 여러 섹션 draft가 있다고 가정하고 intro/conclusion을 설계한다.
5. 마지막에 editor로 전체를 합친다.

이 순서가 자연스러운 이유는, 개별 산출물에서 전역 산출물로 올라가기 때문이다.

---

## 7. 스스로 점검할 질문

- `SectionBrief` 하나를 받으면 section writer가 충분히 구체적인 초안을 만들 수 있는가?
- intro/conclusion이 body 섹션과 톤이 어긋나지 않는가?
- editor 이후 문서가 더 자연스럽고 덜 중복되는가?
- 편집 후 문서 길이가 과하게 줄지 않는가?

---

## 8. 다음 문서로 넘어가기 전 완료 조건

- section writer가 단일 섹션 초안을 만들 수 있다.
- intro/conclusion writer가 전역 문맥을 반영한 초안을 만들 수 있다.
- editor가 여러 초안을 통합해 하나의 문서 초안을 만들 수 있다.
- 이제 reviewer와 patch가 왜 필요한지 자연스럽게 느껴진다.

다음 문서: [`docs/implementation-guide-05-review-patch-and-orchestration.md`](/Users/NWZ-leejss/projects/personal/document-agent/docs/implementation-guide-05-review-patch-and-orchestration.md)
