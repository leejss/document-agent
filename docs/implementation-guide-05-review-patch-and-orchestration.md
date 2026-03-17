# 구현 가이드 5: 리뷰, 패치, 오케스트레이션으로 전체 완성하기

## 1. 이 문서의 역할

이 문서는 마지막 5권이다.

이번 권에서는 전체 시스템을 “완성된 워크플로우”로 만든다. 앞선 권들에서 입력, 계획, 작성, 편집까지 만들었다면, 이번에는 품질 점검과 전체 연결을 마무리한다.

이번 권의 축은 네 가지다.

1. reviewer 구현
2. patch 구현
3. orchestrator 구현
4. LLM/로깅 인프라 연결

### 💡 왜 "검토(Review)"와 "패치(Patch)" 루프가 필요한가? (Why?)
LLM은 가끔 환각(Hallucination)을 일으키거나 제약 사항을 무시한다.
- **최종 방어선**: `Reviewer`는 인간 편집자처럼 냉정하게 결과물을 평가한다.
- **최소 비용 수정**: 전체를 다시 쓰는 대신, 틀린 부분만 고치는 `Patch` 메커니즘을 통해 리소스(토큰)를 아끼면서 품질을 확보한다.

### 🚀 오케스트레이터의 미래 역할 (Role)
- **지휘자(Conductor)**: 지금까지 만든 모든 파편(Analyzer, Planner, Writer, Editor, Reviewer)을 하나의 흐름으로 엮는 시스템의 **심장**이 된다.
- **복원력(Resilience)**: 에러가 발생했을 때 재시도하거나, 품질이 미달일 때 다시 루프를 돌리는 등 전체 프로세스의 생존력을 책임진다.

---

## 2. 이번 권에서 다룰 파일

- [`src/application/services/reviewer-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/reviewer-service.ts)
- [`src/application/services/patch-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/patch-service.ts)
- [`src/application/services/document-orchestrator.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/document-orchestrator.ts)
- [`src/application/ports/llm-client.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/ports/llm-client.ts)
- [`src/application/ports/logger.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/ports/logger.ts)
- [`src/application/ports/clock.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/ports/clock.ts)
- [`src/infrastructure/llm/openai-llm-client.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/infrastructure/llm/openai-llm-client.ts)
- [`src/infrastructure/logging/console-logger.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/infrastructure/logging/console-logger.ts)
- [`src/agents/prompts/reviewer.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/reviewer.ts)
- [`src/agents/prompts/patch.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/patch.ts)

필요하면 함께 다시 볼 파일:

- [`src/domain/types/review.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/review.ts)
- [`src/domain/types/runtime.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/runtime.ts)

---

## 3. 먼저 이해할 개념

이번 권의 핵심은 “한 번 생성하고 끝”이 아니라, **품질을 확인하고 필요한 만큼만 보강하는 시스템**을 만드는 것이다.

각 요소의 역할은 이렇다.

- reviewer
  - 약한 부분을 찾아낸다.
- patch
  - 약한 부분만 고친다.
- orchestrator
  - 전체 단계를 연결하고 상태를 관리한다.
- infrastructure
  - 실제 외부 세계와 연결한다.

이 네 요소가 있어야 비로소 “에이전트 시스템”처럼 동작한다.

---

## 4. 직접 타이핑 순서

### 4.1 `reviewer-service.ts`

먼저 reviewer를 친다.

이유:

- patch는 reviewer 출력이 있어야 의미 있게 동작한다.
- orchestrator도 reviewer 기준을 알아야 흐름을 조정할 수 있다.

집중할 것:

- 필수 섹션 누락 탐지
- 최소 분량 미달 탐지
- 논리 흐름 문제 탐지
- `weakSections`를 patch가 바로 쓸 수 있는 형태로 반환

스스로 답할 질문:

- reviewer는 정적 규칙과 LLM 판단을 어떻게 섞을까?
- “애매하다” 같은 피드백을 어떻게 패치 가능한 지시로 바꿀까?

직접 타이핑 코드:

```ts
// src/application/services/reviewer-service.ts
import type { LlmClient } from "../ports/llm-client.ts";
import type { Logger } from "../ports/logger.ts";
import type {
  GlobalDocumentBrief,
  OutlinePlan,
} from "../../domain/types/planner.ts";
import type { ReviewResult } from "../../domain/types/review.ts";
import { REVIEWER_SYSTEM_PROMPT } from "../../agents/prompts/reviewer.ts";

export async function reviewDocument(
  input: {
    globalBrief: GlobalDocumentBrief;
    outline: OutlinePlan;
    document: string;
  },
  deps: {
    llm: LlmClient;
    logger: Logger;
  },
): Promise<ReviewResult> {
  deps.logger.info("reviewer 시작");

  return deps.llm.generateStructured<ReviewResult>({
    schemaName: "review-result",
    systemPrompt: REVIEWER_SYSTEM_PROMPT,
    userPrompt: JSON.stringify(input),
  });
}
```

### 4.2 `reviewer.ts` 프롬프트

그다음 reviewer 프롬프트를 친다.

중요한 점:

- reviewer가 단순 pass/fail만 내리면 patch가 무력해진다.
- 출력은 반드시 구조화되어야 한다.

직접 타이핑 코드:

```ts
// src/agents/prompts/reviewer.ts
export const REVIEWER_SYSTEM_PROMPT = `
당신은 문서 품질을 점검하는 reviewer다.
결과는 반드시 JSON 형식으로 응답해야 한다.

반드시 지켜야 할 규칙:
- pass/fail만 주지 말고 구체적 진단을 제공한다.
- weakSections를 식별한다.
- 각 약점에 대해 patch 가능한 suggestedFixes를 제공한다.
- 문서 길이, 논리 흐름, 독자 적합성, 누락과 중복을 함께 점검한다.
`.trim();
```

### 4.3 `patch-service.ts`와 `patch.ts`

이제 patch를 친다.

집중할 것:

- 전체 재생성이 아니라 부분 보강
- reviewer 진단을 구체적 수정 지시로 변환
- 패치 후 어떤 후속 단계를 다시 돌릴지 결정

질문:

- 패치는 문장 일부 수정인가, 섹션 재작성인가?
- patch 후 editor를 다시 태울까?
- patch 횟수 제한은 어디서 강제할까?

직접 타이핑 코드:

```ts
// src/application/services/patch-service.ts
import type { LlmClient } from "../ports/llm-client.ts";
import type { Logger } from "../ports/logger.ts";
import type {
  GlobalDocumentBrief,
  SectionBrief,
} from "../../domain/types/planner.ts";
import type { PatchRequest, PatchResult } from "../../domain/types/review.ts";
import type { SectionDraft } from "../../domain/types/section.ts";
import { PATCH_SYSTEM_PROMPT } from "../../agents/prompts/patch.ts";

export async function patchSection(
  input: {
    globalBrief: GlobalDocumentBrief;
    sectionBrief: SectionBrief;
    currentDraft: SectionDraft;
    patchRequest: PatchRequest;
  },
  deps: {
    llm: LlmClient;
    logger: Logger;
  },
): Promise<PatchResult> {
  deps.logger.info("patch 시작", {
    sectionId: input.sectionBrief.id,
  });

  const patchedContent = await deps.llm.generateText({
    systemPrompt: PATCH_SYSTEM_PROMPT,
    userPrompt: JSON.stringify(input),
  });

  return {
    sectionId: input.sectionBrief.id,
    patchedContent,
    changeSummary: ["reviewer가 지적한 약점을 반영해 섹션을 보강했다."],
  };
}
```

```ts
// src/agents/prompts/patch.ts
export const PATCH_SYSTEM_PROMPT = `
당신은 문서의 약한 섹션만 선택적으로 보강하는 patch writer다.

반드시 지켜야 할 규칙:
- 전체 문서를 다시 쓰지 않는다.
- patchRequest의 지시를 우선 반영한다.
- 기존 문체와 용어 일관성을 유지한다.
- 부족한 설명, 예시, 하위 포인트를 보강한다.
`.trim();
```

### 4.4 포트와 인프라

이제 시스템의 혈관인 로그와 심장인 LLM을 연결한다.

### 💡 왜 인프라(Infrastructure)를 분리하는가? (Why?)
비즈니스 로직(서비스)이 특정 SDK(예: OpenAI SDK)에 종속되면 안 되기 때문이다.
- **교체 용이성**: 나중에 Anthropic(Claude)이나 로컬 LLM(Ollama)으로 바꾸고 싶을 때, 서비스 코드는 한 줄도 안 고치고 인프라 파일만 갈아 끼우면 된다.
- **테스트 가능성**: 실제 돈이 나가는 LLM을 호출하는 대신, 가짜 LLM(Mock)을 끼워 넣어 테스트하기가 훨씬 쉬워진다.

### 🚀 인프라의 미래 역할 (Role)
- **외부 세계의 대변인**: 서비스가 "문서 써줘"라고 추상적으로 말하면, 인프라는 이를 실제 API 호출로 바꾸고, 에러가 나면 재시도하는 고된 일을 도맡아 한다.

> **Note**: OpenAI SDK와 Zod 변환 도구를 설치해야 합니다.
> `bun add openai zod-to-json-schema`

직접 타이핑 코드:

```ts
// src/application/ports/llm-client.ts
import { z } from "zod";

export interface LlmTextGenerationParams {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmStructuredGenerationParams<T> {
  schemaName: string;
  schema: z.ZodSchema<T>; // Zod 스키마를 직접 전달받음
  systemPrompt: string;
  userPrompt: string;
}

export interface LlmClient {
  generateText(params: LlmTextGenerationParams): Promise<string>;
  generateStructured<T>(
    params: LlmStructuredGenerationParams<T>,
  ): Promise<T>;
}
```

```ts
// src/application/ports/logger.ts
export interface Logger {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}
```

```ts
// src/application/ports/clock.ts
export interface Clock {
  now(): Date;
  nowIso(): string;
}
```

```ts
// src/infrastructure/logging/console-logger.ts
import type { Logger } from "../../application/ports/logger.ts";

export const consoleLogger: Logger = {
  info(message, metadata) {
    console.info(`[INFO] ${message}`, metadata ? JSON.stringify(metadata) : "");
  },
  warn(message, metadata) {
    console.warn(`[WARN] ${message}`, metadata ? JSON.stringify(metadata) : "");
  },
  error(message, metadata) {
    console.error(`[ERROR] ${message}`, metadata ? JSON.stringify(metadata) : "");
  },
};
```

```ts
// src/infrastructure/llm/openai-llm-client.ts
import OpenAI from "openai";
import { zodToJsonSchema } from "zod-to-json-schema"; // Zod -> JSON Schema 변환기
import type {
  LlmClient,
  LlmStructuredGenerationParams,
  LlmTextGenerationParams,
} from "../../application/ports/llm-client.ts";

export class OpenAiLlmClient implements LlmClient {
  private readonly client: OpenAI;
  private readonly model = "gpt-4o";

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY가 .env 파일에 설정되어 있지 않습니다.");
    }
    this.client = new OpenAI({ apiKey });
  }

  async generateText(params: LlmTextGenerationParams): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
      temperature: params.temperature ?? 0.7,
    });

    return response.choices[0].message.content || "";
  }

  async generateStructured<T>(
    params: LlmStructuredGenerationParams<T>,
  ): Promise<T> {
    // 1. Zod 스키마를 OpenAI가 이해하는 JSON Schema 형식으로 변환
    // Structured Outputs를 위해 strict: true와 호환되는 schema를 생성
    const jsonSchema = zodToJsonSchema(params.schema, {
      target: "openApi3", // OpenAI는 OpenAPI 3.1 / JSON Schema 7 기반
      $refStrategy: "none",
    });

    // 2. Structured Outputs (json_schema) 호출
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: params.schemaName,
          strict: true,
          schema: jsonSchema as any,
        },
      },
    });

    const content = response.choices[0].message.content || "{}";

    try {
      return JSON.parse(content) as T;
    } catch (e) {
      throw new Error(`JSON 파싱 실패. 응답 내용: ${content}`);
    }
  }
}
```

### 4.5 `document-orchestrator.ts`

마지막으로 오케스트레이터를 친다.

이유:

- 이제야 하위 재료가 다 모였기 때문이다.
- 오케스트레이터는 가장 먼저 이해해야 하지만, 가장 나중에 구현하는 것이 보통 안전하다.

집중할 것:

- 단계 호출 순서
- `DocumentRuntimeState` 업데이트
- 단계별 로그 기록
- 실패/재시도/패치 반복 정책

직접 타이핑 코드:

```ts
// src/application/services/document-orchestrator.ts
import type { LlmClient } from "../ports/llm-client.ts";
import type { Logger } from "../ports/logger.ts";
import type { GeneratedDocumentResult } from "../../domain/types/document.ts";
import type { CreateDocumentRequest } from "../../domain/types/request.ts";
import { analyzeRequest } from "./request-analyzer.ts";
import { createPlan } from "./planner-service.ts";
import { writeSectionDraft } from "./section-writer-service.ts";
import { writeIntroduction } from "./intro-writer-service.ts";
import { writeConclusion } from "./conclusion-writer-service.ts";
import { editDocument } from "./editor-service.ts";
import { reviewDocument } from "./reviewer-service.ts";

export async function generateDocument(
  request: CreateDocumentRequest,
  deps: {
    llm: LlmClient;
    logger: Logger;
  },
): Promise<GeneratedDocumentResult> {
  const normalizedRequest = await analyzeRequest(request);
  const plannerResult = await createPlan(normalizedRequest, deps);

  const sectionDrafts = await Promise.all(
    plannerResult.outline.sections.map((sectionBrief) =>
      writeSectionDraft(
        {
          globalBrief: plannerResult.globalBrief,
          sectionBrief,
        },
        deps,
      ),
    ),
  );

  const introduction = await writeIntroduction(
    {
      globalBrief: plannerResult.globalBrief,
      outline: plannerResult.outline,
      sectionDrafts,
    },
    deps,
  );

  const conclusion = await writeConclusion(
    {
      globalBrief: plannerResult.globalBrief,
      outline: plannerResult.outline,
      sectionDrafts,
    },
    deps,
  );

  const mergedDraft = await editDocument(
    {
      globalBrief: plannerResult.globalBrief,
      outline: plannerResult.outline,
      sectionDrafts: [introduction, ...sectionDrafts, conclusion],
    },
    deps,
  );

  const review = await reviewDocument(
    {
      globalBrief: plannerResult.globalBrief,
      outline: plannerResult.outline,
      document: mergedDraft,
    },
    deps,
  );

  return {
    finalDocument: mergedDraft,
    state: {
      request: normalizedRequest,
      plannerResult,
      sectionStates: {},
      sectionDrafts: Object.fromEntries(
        sectionDrafts.map((draft) => [draft.sectionId, draft]),
      ),
      mergedDraft,
      finalDocument: mergedDraft,
      logs: [],
    },
    review,
  };
}
```

---

## 5. 구현 포인트

이번 권에서 제일 중요한 것은 “책임을 올바른 레벨에 두는 것”이다.

예를 들어:

- reviewer가 patch까지 결정하면 책임이 섞인다.
- orchestrator가 section writer 내부 규칙까지 알면 경계가 흐려진다.
- infrastructure 구현체가 planner 정책을 알면 계층이 오염된다.

이 권은 코드 양보다 경계 감각이 더 중요하다.

---

## 6. 직접 타이핑할 때 추천 루틴

1. reviewer 결과 타입을 다시 본다.
2. reviewer를 구현한다.
3. patch를 reviewer 출력에 맞춰 구현한다.
4. 포트와 인프라를 정리한다.
5. 마지막에 orchestrator에서 전체를 연결한다.

이 순서가 좋은 이유는, 오케스트레이터가 최종 조립자여야 하기 때문이다.

---

## 7. 스스로 점검할 질문

- reviewer 결과만 보고 어떤 섹션이 왜 약한지 설명할 수 있는가?
- patch가 전체 재생성이 아니라 부분 보강으로 동작하는가?
- orchestrator가 하위 서비스 책임을 침범하지 않는가?
- 외부 LLM 구현체를 교체해도 application 계층이 유지되는가?

---

## 8. 이 5권 시리즈를 다 읽은 뒤의 목표

이제 아래를 할 수 있으면 좋다.

- 시스템 전체 흐름을 말로 설명할 수 있다.
- 각 서비스의 책임을 구분해서 설명할 수 있다.
- 왜 타입을 먼저 잡았는지 설명할 수 있다.
- 왜 오케스트레이터를 가장 먼저 이해하고 가장 나중에 구현하는지 설명할 수 있다.
- 이 코드베이스를 복붙이 아니라 자기 생각으로 구현할 수 있다.

---

## 9. 최종 완료 조건

아래가 되면 이 시리즈의 목표를 달성한 것이다.

- request -> planner -> writing -> editing -> review -> patch -> orchestration 흐름을 직접 구현했다.
- 각 단계의 입출력 타입을 이해하고 있다.
- 어떤 로직이 어느 파일에 있어야 하는지 스스로 판단할 수 있다.
- 이 프로젝트 구조를 다른 agent workflow에도 응용할 감각이 생겼다.

이제부터는 문서를 따라가는 단계보다, 직접 설계 결정을 언어화하고 검증하는 단계로 넘어가면 된다.
