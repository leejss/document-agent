# 구현 가이드 3: Planner를 시스템의 설계자로 구현하기

## 1. 이 문서의 역할

이 문서는 3권이다.

이번 권은 이 프로젝트의 중심인 planner를 구현하는 데 집중한다. 이 단계가 중요한 이유는, planner 품질이 이후 section writer, editor, reviewer의 출발점을 거의 결정하기 때문이다.

쉽게 말해, planner가 약하면 뒤에서 아무리 잘 써도 흔들린다.

### 💡 왜 플래너는 "목차"가 아닌 "설계"를 하는가? (Why?)
LLM에게 "목차를 짜라"고 하면 그럴듯한 제목만 나열하고 만다.
- **의도된 집필**: "무엇을 쓸 것인가" 뿐만 아니라 "어떤 톤으로, 어떤 내용을 담아, 누구를 위해"를 미리 정해야 작가(Writer)들이 딴길로 새지 않는다.
- **데이터 기반 검증**: Zod로 응답을 엄격하게 검증하는 이유는, 설계도가 고장 난 상태로 집필을 시작하면 전체 문서를 폐기해야 하는 비싼 비용이 들기 때문이다.

### 🚀 설계된 결과의 미래 역할 (Role)
- **작가의 지침서**: 각 `SectionBrief`는 4권의 `SectionWriter`에게 전달되어 "이것만 보고도 글을 쓸 수 있는" 완벽한 명세서가 된다.
- **검토의 기준**: 플래너가 세운 `StyleGuide`와 `SectionBrief`는 5권에서 `Reviewer`가 "글이 설계대로 잘 써졌는가?"를 판단하는 유일한 정답지가 된다.

---

## 2. 이번 권에서 다룰 파일

- [`src/application/services/planner-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/planner-service.ts)
- [`src/agents/prompts/planner.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/planner.ts)
- [`src/agents/mappers/llm-result-mapper.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/mappers/llm-result-mapper.ts)

필요하면 함께 다시 볼 파일:

- [`src/domain/types/planner.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/planner.ts)
- [`src/application/services/execution-planner-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/execution-planner-service.ts)

---

## 3. 먼저 이해할 개념

planner의 역할은 “목차 생성”이 아니다.

planner는 아래를 모두 설계해야 한다.

- 문서 제목
- 전역 브리프
- 섹션 구조
- 섹션별 목적
- 섹션별 핵심 포인트
- 최소 분량
- 중복 회피 경계
- 의존성
- 병렬 가능 여부

즉, planner는 초안을 직접 쓰지 않지만, 초안이 어떤 기준으로 써야 하는지 정한다.

---

## 4. 직접 타이핑 순서

### 4.1 `planner.ts` 프롬프트를 먼저 읽는다

코드를 먼저 치기 전에 프롬프트 파일부터 다시 본다.

이유:

- planner 서비스는 결국 어떤 구조화 출력을 요구할지 명확해야 구현이 자연스럽다.
- 출력 스키마를 먼저 떠올리고 서비스 코드를 짜는 편이 덜 흔들린다.

질문:

- planner에게 “좋은 계획”을 어떤 문장으로 요구할 것인가?
- 아웃라인 수, 각 섹션 목적, requiredElements, dependency를 어떻게 분명히 요청할 것인가?

직접 타이핑 코드:

```ts
// src/agents/prompts/planner.ts
export const PLANNER_SYSTEM_PROMPT = `
당신은 문서 구조를 설계하는 planner다.
당신의 목표는 본문을 직접 쓰는 것이 아니라, 실행 가능한 문서 계획을 만드는 것이다.
결과는 반드시 JSON 형식으로 응답해야 한다.

반드시 지켜야 할 규칙:
- 섹션 수는 기본적으로 5~9개 범위를 유지한다.
- 각 섹션은 하나의 분명한 목적을 가진다.
- 각 섹션에는 keyPoints, requiredElements, minWordCount, dependencies가 있어야 한다.
- 섹션 간 중복을 줄이기 위한 경계를 명시한다.
- 결과는 구조화된 형태로 반환한다.
`.trim();
```

### 4.2 `planner-service.ts`

이제 planner 서비스를 친다.

핵심 역할:

- 정규화된 요청을 받아 planner 결과를 만든다.
- 필요하면 구조화 응답을 파싱한다.
- 산출물이 최소한의 sanity check를 통과하도록 한다.
- execution group 계산과 연결한다.

직접 구현할 때 집중할 것:

- `GlobalDocumentBrief`를 어떻게 채울지
- `SectionBrief[]`가 추상적이지 않게 하려면 무엇을 강제할지
- `requiredSections`와 `constraints`를 어디에 녹일지

### 4.3 `llm-result-mapper.ts`

마지막으로 mapper를 친다.

핵심 역할:

- LLM 응답을 내부 타입으로 바꾸는 경계선
- 필요한 최소 검증 수행

생각할 것:

- mapper는 파서일까, validator일까?
- 구조화 응답이 조금 틀렸을 때 자동 보정할까, 에러로 돌릴까?

직접 타이핑 코드:

```ts
// src/application/services/planner-service.ts
import { z } from "zod"; // zod 추가
import type { LlmClient } from "../ports/llm-client.ts";
import type { Logger } from "../ports/logger.ts";
import { buildExecutionGroups } from "./execution-planner-service.ts";
import type { PlannerResult, SectionBrief } from "../../domain/types/planner.ts";
import type { NormalizedDocumentRequest } from "../../domain/types/request.ts";
import {
  DEFAULT_OUTLINE_SECTION_MAX,
  DEFAULT_OUTLINE_SECTION_MIN,
} from "../../domain/constants/quality-rules.ts";
import { mapStructuredResult } from "../../agents/mappers/llm-result-mapper.ts";
import { PLANNER_SYSTEM_PROMPT } from "../../agents/prompts/planner.ts";

// 1. LLM 응답용 Zod 스키마 정의 (런타임 검증용)
const PlannerStructuredOutputSchema = z.object({
  title: z.string(),
  summary: z.string(),
  glossary: z.array(z.string()),
  styleGuide: z.object({
    tone: z.enum(["formal", "friendly", "professional", "academic"]),
    audienceLevel: z.enum(["beginner", "intermediate", "advanced", "mixed"]),
    terminologyRules: z.array(z.string()),
    forbiddenPatterns: z.array(z.string()),
    lengthPolicy: z.object({
      targetLength: z.enum(["short", "medium", "long"]),
      minSections: z.number(),
      maxSections: z.number(),
    }),
  }),
  avoidOverlapRules: z.array(z.string()),
  plannerNotes: z.array(z.string()),
  sections: z.array(z.object({
    id: z.string(),
    title: z.string(),
    kind: z.enum(["introduction", "body", "conclusion", "appendix", "faq"]),
    purpose: z.string(),
    keyPoints: z.array(z.string()),
    requiredElements: z.array(z.enum(["explanation", "example", "comparison", "code", "checklist"])),
    minWordCount: z.number(),
    dependencies: z.array(z.string()),
    avoidOverlapWith: z.array(z.string()),
    parallelizable: z.boolean(),
  })),
});

type PlannerStructuredOutput = z.infer<typeof PlannerStructuredOutputSchema>;

export async function createPlan(
  request: NormalizedDocumentRequest,
  deps: {
    llm: LlmClient;
    logger: Logger;
  },
): Promise<PlannerResult> {
  deps.logger.info("planner 시작", { topic: request.topic });

  // 2. generateStructured에 스키마를 전달 (Structured Outputs 활용)
  // LLM이 생성 단계에서 이미 이 스키마를 100% 준수하도록 강제됨
  const structured = await deps.llm.generateStructured<PlannerStructuredOutput>({
    schemaName: "planner-result",
    schema: PlannerStructuredOutputSchema, // 스키마 직접 전달
    systemPrompt: PLANNER_SYSTEM_PROMPT,
    userPrompt: JSON.stringify({
      request,
      rules: {
        minSections: DEFAULT_OUTLINE_SECTION_MIN,
        maxSections: DEFAULT_OUTLINE_SECTION_MAX,
      },
    }),
  });

  return {
    globalBrief: {
      topic: request.topic,
      purpose: request.purpose,
      targetAudience: request.audience,
      documentFormat: request.format,
      title: structured.title,
      summary: structured.summary,
      glossary: structured.glossary,
      styleGuide: structured.styleGuide,
      mustInclude: request.requiredSections,
      constraints: request.constraints,
      avoidOverlapRules: structured.avoidOverlapRules,
    },
    outline: {
      title: structured.title,
      sections: structured.sections as SectionBrief[],
    },
    executionGroups: buildExecutionGroups(structured.sections as SectionBrief[]),
    plannerNotes: structured.plannerNotes,
  };
}
```

```ts
// src/agents/mappers/llm-result-mapper.ts
import { z } from "zod";

/**
 * mapStructuredResult는 LLM의 원시 응답(unknown)을
 * Zod 스키마를 이용해 런타임에 검증하고 타입이 보장된 결과로 반환한다.
 */
export function mapStructuredResult<T>(schema: z.ZodSchema<T>, input: unknown): T {
  if (input == null) {
    throw new Error("구조화 응답이 비어 있습니다.");
  }

  const result = schema.safeParse(input);

  if (!result.success) {
    const errorDetails = JSON.stringify(result.error.format(), null, 2);
    throw new Error(`구조화 응답 검증 실패:\n${errorDetails}`);
  }

  return result.data;
}
```

---

## 5. planner 구현에서 중요한 질문

planner를 구현하면서 아래 질문을 계속 붙잡는 것이 좋다.

- 이 섹션은 왜 존재하는가?
- 이 섹션은 다른 섹션과 무엇이 다른가?
- 이 섹션은 어떤 관찰 가능한 산출물을 만들어야 하는가?
- 이 섹션은 다른 섹션과 어디서 겹치지 않아야 하는가?

이 질문에 답할 수 없다면, 그 section brief는 아직 약한 것이다.

---

## 6. 직접 타이핑할 때 추천 순서

1. planner 출력으로 원하는 JSON 모양을 먼저 종이에 적는다.
2. 그 구조를 만족하게 타입을 다시 본다.
3. 프롬프트 초안을 쓴다.
4. 서비스에서 LLM 호출 전후 흐름을 작성한다.
5. mapper에서 최소 sanity check를 붙인다.
6. execution group 계산을 마지막에 연결한다.

이 순서로 가면 “프롬프트는 있는데 서비스가 못 받는” 상황을 줄일 수 있다.

---

## 7. 구현 포인트

좋은 planner 구현은 아래 특징이 있다.

- 결과를 읽으면 문서 구조가 머릿속에 그려진다.
- 각 섹션 purpose가 겹치지 않는다.
- section writer가 “이걸 어떻게 써야 하지?”라고 당황하지 않는다.
- reviewer 기준 일부가 이미 planner 단계에서 예방된다.

반대로 나쁜 planner 구현은 아래 특징이 있다.

- 제목만 그럴듯하고 brief가 비어 있다.
- 섹션 간 경계가 모호하다.
- dependency가 형식적이다.
- execution group이 아무 의미 없이 붙어 있다.

---

## 8. 스스로 점검할 질문

- planner 결과만 보고 문서 구조를 설명할 수 있는가?
- `requiredSections`와 `constraints`가 실제 결과에 반영되는가?
- `SectionBrief` 하나만 떼어 봐도 section writer가 바로 쓸 수 있는가?
- 병렬 실행 정보가 실제로 의미 있게 계산되는가?

---

## 9. 다음 문서로 넘어가기 전 완료 조건

- planner가 `PlannerResult`를 안정적으로 반환한다.
- 각 `SectionBrief`가 충분히 구체적이다.
- planner 결과가 execution group과 자연스럽게 이어진다.
- 이제 section writer가 이 brief를 받아 글을 쓰는 그림이 보인다.

다음 문서: [`docs/implementation-guide-04-writing-and-editing.md`](/Users/NWZ-leejss/projects/personal/document-agent/docs/implementation-guide-04-writing-and-editing.md)
