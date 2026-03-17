# Planner-Executor 문서 에이전트 설계 문서

## 1. 문서 목적

이 문서는 [`PRD.md`](/Users/NWZ-leejss/projects/personal/document-agent/PRD.md)를 바탕으로, 구현 전에 먼저 합의해야 할 설계 초안을 정리한다.

범위는 아래 네 가지에 한정한다.

1. 타입 정의
2. 폴더 구조 정의
3. 함수 시그니처 정의
4. 개발자가 먼저 읽어야 하는 주석과 설계 메모

이 문서는 학습용 설계 문서이므로 **실제 구현 코드는 포함하지 않는다.**

---

## 2. 설계 원칙

### 2.1 설계 원칙 요약

- 문서 작성은 단일 호출이 아니라 오케스트레이션 가능한 단계적 워크플로우로 다룬다.
- 전역 구조 설계와 섹션 실행은 분리한다.
- 상태와 산출물은 명시적 타입으로 추적한다.
- 병렬화는 섹션 작성처럼 독립성이 높은 단계에만 제한적으로 적용한다.
- editor/reviewer/patch 단계는 “품질 회복”을 담당하는 후처리 계층으로 분리한다.

### 2.2 구현 전제

- 런타임은 Bun을 사용한다.
- 언어는 TypeScript를 사용한다.
- 초기 MVP에서는 외부 검색, 인용, 장기 메모리, 사람 승인 루프는 제외한다.
- LLM 호출 레이어는 추후 교체 가능하도록 포트(interface)로 감싼다.

---

## 3. 시스템 개요

### 3.1 상위 흐름

```text
User Input
  -> Request Analyzer
  -> Planner
  -> Execution Plan 생성
  -> 병렬 가능한 Section Executor 실행
  -> Intro/Conclusion 작성
  -> Editor 통합
  -> Reviewer 점검
  -> Patch/Rewriter 보강
  -> Final Document
```

### 3.2 책임 분리

- `Request Analyzer`
  - 사용자 입력을 정규화한다.
  - 빠진 필드를 기본값으로 보완한다.
  - planner가 사용할 전역 요청 객체를 만든다.
- `Planner`
  - 문서 제목, 아웃라인, 섹션 brief, 의존성, 병렬 그룹을 설계한다.
- `Section Executor`
  - 섹션 하나의 초안을 생성한다.
  - 최소 분량, 포함 요소, 중복 회피 규칙을 적용한다.
- `Intro/Conclusion Writer`
  - 전체 아웃라인과 본문 초안 상태를 기반으로 서론/결론을 생성한다.
- `Editor`
  - 섹션 초안을 합치고 용어/톤/연결성을 다듬는다.
- `Reviewer`
  - 누락, 중복, 길이 부족, 논리 약점을 식별한다.
- `Patch/Rewriter`
  - 약한 섹션만 선택적으로 재작성한다.

---

## 4. 권장 폴더 구조

초기 Bun 프로젝트는 현재 루트에 [`index.ts`](/Users/NWZ-leejss/projects/personal/document-agent/index.ts)만 있는 매우 얕은 구조다. 구현 단계에서는 아래 구조로 확장하는 것을 권장한다.

```text
document-agent/
  docs/
    planner-executor-design.md
  src/
    index.ts
    domain/
      types/
        request.ts
        planner.ts
        section.ts
        document.ts
        review.ts
        runtime.ts
      constants/
        section-status.ts
        quality-rules.ts
    application/
      ports/
        llm-client.ts
        logger.ts
        clock.ts
      services/
        request-analyzer.ts
        planner-service.ts
        section-writer-service.ts
        intro-writer-service.ts
        conclusion-writer-service.ts
        editor-service.ts
        reviewer-service.ts
        patch-service.ts
        execution-planner-service.ts
        document-orchestrator.ts
    agents/
      prompts/
        planner.ts
        section-writer.ts
        editor.ts
        reviewer.ts
        patch.ts
      mappers/
        llm-result-mapper.ts
    infrastructure/
      llm/
        openai-llm-client.ts
      logging/
        console-logger.ts
    shared/
      utils/
        ids.ts
        text.ts
        arrays.ts
        asserts.ts
  tests/
    unit/
    integration/
```

### 4.1 구조 선택 이유

- `domain`
  - 비즈니스 개념과 상태 모델을 한곳에 모은다.
  - LLM 벤더나 실행 방식이 바뀌어도 가장 덜 흔들리는 층이다.
- `application`
  - 실제 유스케이스와 오케스트레이션을 담는다.
  - “무엇을 어떤 순서로 호출할지”를 표현한다.
- `agents`
  - 프롬프트와 응답 매핑 규칙을 별도 관리한다.
  - 향후 프롬프트 실험 시 영향 범위를 줄인다.
- `infrastructure`
  - 외부 API, 로깅, 저장소 연결처럼 교체 가능성이 큰 구현체를 둔다.
- `shared`
  - 도메인 의미가 약한 순수 유틸을 둔다.

---

## 5. 타입 설계

아래 타입은 “실제 구현 시점의 초안 인터페이스”를 제안하는 것이다. 필드명은 구현 과정에서 일부 조정될 수 있지만, 상태 흐름과 책임 경계는 가능한 유지하는 것이 좋다.

### 5.1 입력 모델

```ts
export type DocumentLength = "short" | "medium" | "long";

export type DocumentFormat =
  | "technical-design"
  | "prd"
  | "guide"
  | "proposal"
  | "generic";

export type Tone =
  | "formal"
  | "neutral"
  | "friendly"
  | "persuasive"
  | "instructional";

export interface CreateDocumentRequest {
  topic: string;
  purpose?: string;
  audience?: string;
  format?: DocumentFormat;
  tone?: Tone;
  targetLength?: DocumentLength;
  requiredSections?: string[];
  constraints?: string[];
}

export interface NormalizedDocumentRequest {
  topic: string;
  purpose: string;
  audience: string;
  format: DocumentFormat;
  tone: Tone;
  targetLength: DocumentLength;
  requiredSections: string[];
  constraints: string[];
}
```

#### 설계 메모

- `CreateDocumentRequest`는 사용자 입력 원본이다.
- `NormalizedDocumentRequest`는 analyzer를 거친 후 planner가 소비하는 입력이다.
- “기본값 채우기”와 “입력 검증”을 분리하면, 추후 CLI/API/웹 입력 채널이 늘어도 재사용이 쉽다.

### 5.2 문서 전역 브리프

```ts
export interface StyleGuide {
  tone: Tone;
  audienceLevel: "beginner" | "intermediate" | "advanced" | "mixed";
  terminologyRules: string[];
  forbiddenPatterns: string[];
  lengthPolicy: {
    targetLength: DocumentLength;
    minSections: number;
    maxSections: number;
  };
}

export interface GlobalDocumentBrief {
  topic: string;
  purpose: string;
  targetAudience: string;
  documentFormat: DocumentFormat;
  title: string;
  summary: string;
  glossary: string[];
  styleGuide: StyleGuide;
  mustInclude: string[];
  constraints: string[];
  avoidOverlapRules: string[];
}
```

#### 설계 메모

- `GlobalDocumentBrief`는 planner와 editor가 공유하는 핵심 계약이다.
- glossary를 초기에 넣어두면 editor 단계의 용어 통일 근거가 생긴다.
- `avoidOverlapRules`는 섹션 간 중복을 줄이기 위한 전역 규칙이다.

### 5.3 아웃라인과 섹션 브리프

```ts
export type SectionKind =
  | "introduction"
  | "body"
  | "conclusion"
  | "appendix"
  | "faq";

export interface SectionBrief {
  id: string;
  title: string;
  kind: SectionKind;
  purpose: string;
  keyPoints: string[];
  requiredElements: Array<"explanation" | "example" | "comparison" | "code" | "checklist">;
  minWordCount: number;
  dependencies: string[];
  avoidOverlapWith: string[];
  parallelizable: boolean;
}

export interface OutlinePlan {
  title: string;
  sections: SectionBrief[];
}

export interface PlannerResult {
  globalBrief: GlobalDocumentBrief;
  outline: OutlinePlan;
  executionGroups: ExecutionGroup[];
  plannerNotes: string[];
}
```

#### 설계 메모

- `SectionBrief`는 executor가 바로 사용할 수 있을 만큼 구체적이어야 한다.
- `requiredElements`를 구조화하면 “설명만 있고 예시가 없는 섹션”을 reviewer가 탐지하기 쉬워진다.
- `dependencies`와 `parallelizable`을 둘 다 두는 이유는, 단순 DAG 여부와 실제 병렬 실행 허용 정책을 분리하기 위해서다.

### 5.4 실행 계획과 상태 모델

```ts
export type SectionStatus =
  | "todo"
  | "ready"
  | "writing"
  | "written"
  | "editing"
  | "done"
  | "failed";

export interface ExecutionGroup {
  id: string;
  sectionIds: string[];
  mode: "parallel" | "sequential";
  reason: string;
}

export interface SectionDraft {
  sectionId: string;
  content: string;
  status: "draft" | "reviewed";
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SectionRuntimeState {
  sectionId: string;
  status: SectionStatus;
  attempts: number;
  lastError?: string;
}

export interface DocumentRuntimeState {
  request: NormalizedDocumentRequest;
  plannerResult?: PlannerResult;
  sectionStates: Record<string, SectionRuntimeState>;
  sectionDrafts: Record<string, SectionDraft>;
  mergedDraft?: string;
  finalDocument?: string;
  logs: WorkflowLog[];
}
```

#### 설계 메모

- `SectionDraft.status`와 `SectionRuntimeState.status`는 다르다.
- 전자는 산출물의 품질 단계(`draft`, `reviewed`)이고, 후자는 실행 상태(`writing`, `failed`)다.
- 이 둘을 분리해야 재시도와 편집 단계를 명확하게 추적할 수 있다.

### 5.5 리뷰와 패치 모델

```ts
export interface ReviewChecklistItemResult {
  key: string;
  passed: boolean;
  message: string;
}

export interface WeakSection {
  sectionId: string;
  reason: string;
  suggestedFixes: string[];
  severity: "low" | "medium" | "high";
}

export interface ReviewResult {
  passed: boolean;
  score: number;
  checklist: ReviewChecklistItemResult[];
  weakSections: WeakSection[];
  globalFeedback: string[];
}

export interface PatchRequest {
  sectionId: string;
  reason: string;
  instructions: string[];
}

export interface PatchResult {
  sectionId: string;
  patchedContent: string;
  changeSummary: string[];
}
```

#### 설계 메모

- reviewer는 pass/fail만 주면 안 되고, patch 가능한 정보까지 내려줘야 한다.
- `WeakSection`과 `PatchRequest`를 분리하면 reviewer와 patcher를 느슨하게 결합할 수 있다.

### 5.6 로깅과 관측성 타입

```ts
export type WorkflowStage =
  | "request-analyzed"
  | "planned"
  | "section-written"
  | "intro-written"
  | "conclusion-written"
  | "edited"
  | "reviewed"
  | "patched"
  | "completed";

export interface WorkflowLog {
  timestamp: string;
  stage: WorkflowStage;
  message: string;
  sectionId?: string;
  metadata?: Record<string, string | number | boolean>;
}
```

#### 설계 메모

- 초기 MVP에서는 단순 로그 배열로 시작해도 충분하다.
- 이후 저장소(DB, 파일, 원격 추적 시스템)가 붙더라도 타입 계약은 유지할 수 있다.

---

## 6. 포트(interface) 설계

도메인/애플리케이션 계층은 외부 LLM 벤더에 직접 의존하지 않도록 포트를 먼저 정의하는 편이 안전하다.

```ts
export interface LlmTextGenerationParams {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmStructuredGenerationParams<TSchemaName extends string> {
  schemaName: TSchemaName;
  systemPrompt: string;
  userPrompt: string;
}

export interface LlmClient {
  generateText(params: LlmTextGenerationParams): Promise<string>;
  generateStructured<T>(params: LlmStructuredGenerationParams<string>): Promise<T>;
}

export interface Logger {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}
```

#### 설계 메모

- planner/reviewer는 구조화 응답을 선호하므로 `generateStructured`가 중요하다.
- section writer/editor는 장문 생성에 가까워 `generateText` 위주가 될 가능성이 높다.
- 스키마 검증 도구는 구현 시점에 `zod` 같은 라이브러리를 붙일 수 있지만, 지금 문서에서는 타입 계약까지만 정의한다.

---

## 7. 서비스별 함수 시그니처

아래 함수는 “구현 전 인터페이스”다. 실제 내부 로직은 비워두되, 입력/출력과 책임 경계를 먼저 고정하는 데 목적이 있다.

### 7.1 Request Analyzer

```ts
/**
 * 사용자 입력을 planner 친화적인 정규화 요청으로 변환한다.
 * - 누락 필드에 기본값을 채운다.
 * - 금지된 입력 조합을 검증한다.
 * - 길이 수준(short/medium/long)을 내부 정책에 맞게 보존한다.
 */
export async function analyzeRequest(
  request: CreateDocumentRequest,
): Promise<NormalizedDocumentRequest>;
```

### 7.2 Planner

```ts
/**
 * 문서의 전역 구조를 설계한다.
 * 이 단계는 직렬 실행을 전제로 하며, 전체 품질의 기준선이 된다.
 */
export async function createPlan(
  request: NormalizedDocumentRequest,
  deps: {
    llm: LlmClient;
    logger: Logger;
  },
): Promise<PlannerResult>;
```

### 7.3 Execution Planner

```ts
/**
 * planner가 정의한 dependency를 기준으로 실행 그룹을 계산한다.
 * 병렬화 가능 여부는 단순 의존성 외에도 정책 조건을 함께 고려한다.
 */
export function buildExecutionGroups(
  sections: SectionBrief[],
): ExecutionGroup[];
```

### 7.4 Section Writer

```ts
/**
 * 단일 섹션 초안을 작성한다.
 * 실패는 전체 워크플로우 중단이 아니라 섹션 단위 재시도 대상으로 취급한다.
 */
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
): Promise<SectionDraft>;
```

### 7.5 Intro/Conclusion Writer

```ts
/**
 * 서론은 outline과 주요 본문 초안이 준비된 뒤 작성한다.
 * 결론은 reviewer 이전 최종 초안 통합 직전에 작성하는 쪽이 자연스럽다.
 */
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
): Promise<SectionDraft>;

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
): Promise<SectionDraft>;
```

### 7.6 Editor

```ts
/**
 * 여러 초안을 하나의 문서로 통합한다.
 * 이 단계는 길이를 과도하게 줄이지 않는 것이 중요한 품질 제약이다.
 */
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
): Promise<string>;
```

### 7.7 Reviewer

```ts
/**
 * 최종 초안의 품질을 체크리스트 기반으로 평가한다.
 * 결과는 단순 판정이 아니라 patch 가능한 진단 정보여야 한다.
 */
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
): Promise<ReviewResult>;
```

### 7.8 Patch/Rewriter

```ts
/**
 * reviewer가 지목한 약한 섹션만 선택적으로 보강한다.
 * 전체 재생성 대신 부분 수정이 목표다.
 */
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
): Promise<PatchResult>;
```

### 7.9 Document Orchestrator

```ts
/**
 * 전체 워크플로우를 조합한다.
 * 이 함수는 "어떤 단계를 어떤 순서로 호출하는가"를 담당하며,
 * 각 단계의 세부 생성 로직은 하위 서비스에 위임한다.
 */
export async function generateDocument(
  request: CreateDocumentRequest,
  deps: {
    llm: LlmClient;
    logger: Logger;
  },
): Promise<{
  finalDocument: string;
  state: DocumentRuntimeState;
  review: ReviewResult;
}>;
```

---

## 8. 개발자가 먼저 읽어야 하는 주석

아래 주석은 구현 파일 상단 또는 핵심 함수 위에 남기기 좋은 “학습용 주석” 예시다.

### 8.1 오케스트레이터 파일 상단 주석 예시

```ts
/**
 * 이 모듈은 문서 생성의 "제어 흐름"만 책임진다.
 *
 * 중요한 원칙:
 * - planner 품질이 전체 품질의 상한선을 결정한다.
 * - section writer는 실패 가능성을 전제로 설계한다.
 * - editor는 문장을 다듬는 단계이지 내용을 대폭 축약하는 단계가 아니다.
 * - reviewer는 판정기가 아니라 진단기여야 한다.
 * - patch는 전체 재생성보다 좁은 수정 범위를 유지해야 한다.
 */
```

### 8.2 Planner 주석 예시

```ts
/**
 * Planner는 단순 목차 생성기가 아니다.
 * 각 섹션이 왜 존재하는지, 무엇을 반드시 포함해야 하는지,
 * 다른 섹션과 어떤 경계를 가져야 하는지까지 정의해야 한다.
 *
 * 구현 시 체크할 것:
 * - 섹션 수는 기본적으로 5~9개 범위를 유지하는가?
 * - 각 섹션 purpose가 서로 구분되는가?
 * - abstract title만 있고 실행 가능한 brief가 비어 있지 않은가?
 */
```

### 8.3 Section Writer 주석 예시

```ts
/**
 * Section writer는 "좋은 글 한 덩어리"보다 "계약을 만족하는 섹션"을 우선한다.
 *
 * 구현 시 체크할 것:
 * - minWordCount를 만족하는가?
 * - requiredElements를 실제 본문이 충족하는가?
 * - avoidOverlapWith 대상과 불필요한 중복이 없는가?
 * - 실패 시 재시도 가능한 입력 단위가 보존되는가?
 */
```

### 8.4 Editor 주석 예시

```ts
/**
 * Editor의 목표는 압축이 아니라 통합이다.
 *
 * 구현 시 체크할 것:
 * - 용어가 전역 glossary와 일치하는가?
 * - 섹션 연결 문장이 자연스러운가?
 * - 중복은 줄였지만 정보량이 과하게 사라지지 않았는가?
 */
```

### 8.5 Reviewer 주석 예시

```ts
/**
 * Reviewer는 pass/fail만 반환하면 안 된다.
 * 후속 patch가 가능하도록 구체적인 약점 위치와 수정 방향을 제공해야 한다.
 *
 * 구현 시 체크할 것:
 * - 누락 섹션을 식별하는가?
 * - 길이 부족 섹션을 찾는가?
 * - 독자 적합성과 논리 흐름 문제를 설명 가능한 문장으로 반환하는가?
 */
```

---

## 9. 권장 구현 순서

학습 효율을 고려하면 아래 순서가 가장 이해하기 쉽다.

1. 입력 타입과 상태 타입부터 정의
2. request analyzer 구현
3. planner 결과 스키마 고정
4. execution group 계산기 구현
5. section writer 인터페이스 구현
6. editor/reviewer/patch 인터페이스 구현
7. 마지막에 orchestrator 연결

### 이유

- planner와 상태 모델이 먼저 고정되어야 이후 단계가 흔들리지 않는다.
- 병렬 실행은 “먼저 타입과 상태를 명확히 만든 뒤” 들어가야 디버깅이 가능하다.
- orchestrator를 너무 빨리 만들면 내부 서비스 경계가 흐려질 가능성이 높다.

---

## 10. MVP 구현 시 주의점

### 10.1 지금 당장 구현하지 않는 것

- 실제 LLM 벤더 선택과 세부 API 연결
- 프롬프트 최적화
- DB 저장
- 외부 검색/RAG
- citation 생성
- 다중 문서 입력

### 10.2 초기에 과설계하지 말아야 할 것

- 복잡한 DAG 엔진
- 지나치게 세분화된 상태 머신
- 문서 타입별 특수 planner 분기
- patch 반복 횟수 자동 최적화

### 10.3 초기에 반드시 구조화해야 할 것

- PlannerResult
- SectionBrief
- ReviewResult
- DocumentRuntimeState

이 네 개는 이후 거의 모든 확장의 기준점이 되므로, 구현 전에 팀 내 합의를 먼저 만드는 것이 좋다.

---

## 11. 권장 시작 파일

실제 구현을 시작할 때는 아래 파일부터 만드는 흐름을 권장한다.

```text
src/domain/types/request.ts
src/domain/types/planner.ts
src/domain/types/section.ts
src/domain/types/review.ts
src/domain/types/runtime.ts
src/application/ports/llm-client.ts
src/application/services/request-analyzer.ts
src/application/services/planner-service.ts
src/application/services/document-orchestrator.ts
src/index.ts
```

---

## 12. 최종 요약

이 설계의 핵심은 “문서 생성 기능”을 만드는 것이 아니라, **문서 생성 과정을 추적 가능하고 수정 가능하며 학습 가능한 구조로 만드는 것**이다.

따라서 구현보다 먼저 아래가 고정되어야 한다.

- 데이터가 어떤 형태로 흐르는가
- 각 단계가 무엇을 책임지는가
- 실패와 품질 저하를 어떤 타입으로 표현하는가
- 부분 재작성은 어떤 입력 계약으로 수행되는가

이 문서를 기준으로 다음 단계에서는 실제 타입 파일 생성, 서비스 스켈레톤 작성, 오케스트레이터 뼈대 구현 순서로 진행하는 것이 적절하다.
