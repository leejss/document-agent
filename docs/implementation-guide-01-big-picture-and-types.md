# 구현 가이드 1: 큰 그림과 타입부터 손에 익히기

## 1. 이 문서의 역할

이 문서는 5개 구현 가이드의 1권이다.

이 권의 목표는 두 가지다.

1. 이 프로젝트가 전체적으로 어떤 흐름으로 동작하는지 먼저 이해한다.
2. 이후 모든 구현의 바닥이 되는 타입과 상태 모델을 직접 타이핑하며 익힌다.

### 💡 왜 타입부터 정의하는가? (Why?)
코드를 한 줄도 쓰기 전에 타입을 먼저 정의하는 이유는 **"사고의 동기화"**를 위해서다.
- **언어의 통일**: `SectionBrief`, `GlobalBrief` 같은 단어가 모든 개발자(또는 AI 서브 에이전트)에게 같은 의미로 전달되게 한다.
- **제약 조건의 발견**: 타입을 정의하다 보면 "아, 섹션은 이전 섹션에 의존성이 있을 수도 있겠구나" 같은 요구사항을 미리 발견하게 된다.
- **컴파일러라는 조수**: 타입을 잘 정의해두면, 나중에 서비스 로직을 짤 때 타입스크립트가 "이 데이터는 빠졌어!"라고 실시간으로 알려준다.

### 🚀 이 타입들의 미래 역할 (Role)
지금 정의하는 타입들은 프로젝트 전체에서 다음과 같은 역할을 수행한다.
- **데이터의 고속도로**: `NormalizedDocumentRequest`는 분석기에서 플래너로, `SectionBrief`는 플래너에서 작가로 흐르는 데이터의 표준 규격이 된다.
- **경계선(Contract)**: 서비스 간의 약속이 된다. "나는 이 타입의 데이터를 줄 테니, 너는 저 타입의 데이터를 돌려줘"라는 명확한 계약서 역할을 한다.

이 문서에서는 아직 “문서를 생성하는 로직”을 구현하지 않는다. 대신, 왜 그런 로직이 필요한지 이해할 수 있는 좌표를 머릿속에 먼저 만든다.

---

## 2. 왜 타입부터 시작하는가

탑다운으로 이해할 때는 먼저 시스템 흐름을 본다. 하지만 실제 타이핑은 타입부터 시작하는 것이 더 안전하다.

이 프로젝트에서 타입은 단순한 선언이 아니다. 타입은 다음을 고정한다.

- 어떤 입력이 들어오는가
- 어떤 계획이 만들어지는가
- 어떤 섹션이 어떤 상태를 가지는가
- 어떤 리뷰 결과가 patch로 이어지는가
- 전체 실행 상태를 어떻게 추적하는가

즉, 타입을 잘 설계하면 나중 구현에서 흔들림이 줄어든다.

---

## 3. 먼저 읽을 파일

아래 파일을 이 순서대로 읽는다.

1. [`PRD.md`](/Users/NWZ-leejss/projects/personal/document-agent/PRD.md)
2. [`docs/planner-executor-design.md`](/Users/NWZ-leejss/projects/personal/document-agent/docs/planner-executor-design.md)
3. [`docs/top-down-guide.md`](/Users/NWZ-leejss/projects/personal/document-agent/docs/top-down-guide.md)
4. [`src/application/services/document-orchestrator.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/document-orchestrator.ts)

그다음 아래 타입 파일을 읽는다.

1. [`src/domain/types/request.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/request.ts)
2. [`src/domain/types/planner.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/planner.ts)
3. [`src/domain/types/section.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/section.ts)
4. [`src/domain/types/review.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/review.ts)
5. [`src/domain/types/runtime.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/runtime.ts)
6. [`src/domain/types/document.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/document.ts)

---

## 4. 머릿속에 먼저 넣어야 할 흐름

이 프로젝트의 핵심 흐름은 아래 한 줄로 외워도 좋다.

```text
요청 정리 -> 계획 생성 -> 섹션 초안 작성 -> 통합 편집 -> 품질 점검 -> 약한 부분 보강
```

각 타입은 이 흐름 중 한 구간을 담당한다.

- `request.ts`
  - 요청 정리 전후 타입
- `planner.ts`
  - 계획 생성 결과 타입
- `section.ts`
  - 섹션 초안과 섹션 실행 상태 타입
- `review.ts`
  - 리뷰와 패치 요청 타입
- `runtime.ts`
  - 전체 워크플로우 상태 타입
- `document.ts`
  - 최종 반환 타입

---

## 5. 직접 타이핑할 파일

이 권에서는 아래 파일을 직접 다시 쳐보는 것을 권장한다.

1. [`src/domain/types/request.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/request.ts)
2. [`src/domain/types/planner.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/planner.ts)
3. [`src/domain/types/section.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/section.ts)
4. [`src/domain/types/review.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/review.ts)
5. [`src/domain/types/runtime.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/runtime.ts)
6. [`src/domain/types/document.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/document.ts)

이미 파일이 있더라도, 학습 목적이라면 새 버퍼에 직접 다시 쳐보는 것이 좋다.

## 5.1 직접 타이핑 코드

먼저 아래 코드를 직접 입력한다.

`src/domain/types/request.ts`

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

`src/domain/types/planner.ts`

```ts
import type { DocumentFormat, DocumentLength, Tone } from "./request.ts";

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

export type SectionKind =
  | "introduction"
  | "body"
  | "conclusion"
  | "appendix"
  | "faq";

export type SectionRequiredElement =
  | "explanation"
  | "example"
  | "comparison"
  | "code"
  | "checklist";

export interface SectionBrief {
  id: string;
  title: string;
  kind: SectionKind;
  purpose: string;
  keyPoints: string[];
  requiredElements: SectionRequiredElement[];
  minWordCount: number;
  dependencies: string[];
  avoidOverlapWith: string[];
  parallelizable: boolean;
}

export interface OutlinePlan {
  title: string;
  sections: SectionBrief[];
}

export interface ExecutionGroup {
  id: string;
  sectionIds: string[];
  mode: "parallel" | "sequential";
  reason: string;
}

export interface PlannerResult {
  globalBrief: GlobalDocumentBrief;
  outline: OutlinePlan;
  executionGroups: ExecutionGroup[];
  plannerNotes: string[];
}
```

`src/domain/types/section.ts`

```ts
export type SectionStatus =
  | "todo"
  | "ready"
  | "writing"
  | "written"
  | "editing"
  | "done"
  | "failed";

export type DraftStatus = "draft" | "reviewed";

export interface SectionDraft {
  sectionId: string;
  content: string;
  status: DraftStatus;
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
```

`src/domain/types/review.ts`

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

`src/domain/types/runtime.ts`

```ts
import type { PlannerResult } from "./planner.ts";
import type { NormalizedDocumentRequest } from "./request.ts";
import type { SectionDraft, SectionRuntimeState } from "./section.ts";

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

`src/domain/types/document.ts`

```ts
import type { DocumentRuntimeState } from "./runtime.ts";
import type { ReviewResult } from "./review.ts";

export interface GeneratedDocumentResult {
  finalDocument: string;
  state: DocumentRuntimeState;
  review: ReviewResult;
}
```

---

## 6. 타이핑 순서

### 6.1 `request.ts`

먼저 요청 타입을 친다.

여기서 집중할 것:

- 사용자 입력 원본과 내부 정규화 입력은 다르다.
- 선택 필드와 필수 필드는 구현 단계에서 다른 부담을 만든다.

직접 답해볼 질문:

- 왜 `CreateDocumentRequest`와 `NormalizedDocumentRequest`를 분리할까?
- analyzer가 없으면 planner가 어떤 부담을 떠안게 될까?

### 6.2 `planner.ts`

그다음 planner 결과 타입을 친다.

여기서 집중할 것:

- planner는 제목만 만드는 것이 아니라 section brief까지 책임진다.
- `ExecutionGroup`은 planner 산출물과 실제 실행 사이를 잇는 다리다.

직접 답해볼 질문:

- `SectionBrief`에 `purpose`와 `requiredElements`가 왜 필요한가?
- `dependencies`와 `parallelizable`은 왜 둘 다 필요한가?

### 6.3 `section.ts`

이제 섹션 산출물과 실행 상태를 친다.

여기서 집중할 것:

- 산출물 상태와 실행 상태는 서로 다른 문제다.
- 이 둘을 섞으면 retry와 patch 단계에서 혼란이 커진다.

직접 답해볼 질문:

- `SectionDraft.status`와 `SectionRuntimeState.status`는 왜 분리되어야 할까?
- 섹션 실패와 문서 실패는 같은 사건인가?

### 6.4 `review.ts`

이제 리뷰와 패치를 잇는 타입을 친다.

여기서 집중할 것:

- reviewer는 판정기가 아니라 진단기다.
- patch는 reviewer가 준 정보를 구조적으로 소비해야 한다.

직접 답해볼 질문:

- `ReviewResult`가 `weakSections`를 꼭 가져야 하는 이유는 무엇일까?
- `PatchRequest`를 따로 두면 reviewer와 patcher가 어떻게 느슨하게 연결될까?

### 6.5 `runtime.ts`와 `document.ts`

마지막으로 전체 상태와 최종 결과 타입을 친다.

여기서 집중할 것:

- 오케스트레이터는 단계별 상태를 누적해서 들고 있어야 한다.
- 최종 반환값은 문서만 있으면 끝나는 게 아니라, 상태와 리뷰까지 가질 수 있다.

직접 답해볼 질문:

- 왜 `DocumentRuntimeState`가 필요한가?
- 사용자가 나중에 “특정 섹션만 다시 써줘”라고 하면 어떤 상태가 필요할까?

---

## 7. 구현 포인트

이 권에서는 구현보다 아래 감각을 익히는 것이 중요하다.

- 타입은 코드를 제한하는 장치이면서 동시에 설계 문서다.
- 지금 만든 타입은 나중 서비스 구현에서 의사결정의 기준점이 된다.
- 타입이 애매하면 서비스 경계도 애매해진다.

그래서 직접 타이핑할 때는 “문법”보다 “왜 이렇게 나뉘어 있는가”를 계속 생각하는 편이 좋다.

---

## 8. 스스로 점검할 질문

- 이 프로젝트의 입력 타입, 계획 타입, 실행 타입, 리뷰 타입을 구분해서 설명할 수 있는가?
- planner 출력이 왜 이렇게 풍부해야 하는지 설명할 수 있는가?
- section 상태와 document 상태를 왜 따로 추적해야 하는가?
- review와 patch가 타입 레벨에서 어떻게 연결되는지 설명할 수 있는가?

---

## 9. 다음 문서로 넘어가기 전 완료 조건

아래가 되면 2권으로 넘어가면 된다.

- 각 타입 파일의 역할을 한 문장씩 설명할 수 있다.
- `PlannerResult`, `SectionDraft`, `ReviewResult`, `DocumentRuntimeState`를 보고 데이터 흐름을 머릿속에 그릴 수 있다.
- “이제 request analyzer와 execution planner가 왜 필요한지” 감이 잡힌다.

다음 문서: [`docs/implementation-guide-02-input-and-execution.md`](/Users/NWZ-leejss/projects/personal/document-agent/docs/implementation-guide-02-input-and-execution.md)
