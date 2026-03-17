# 구현 가이드 2: 입력 정리와 실행 흐름의 뼈대 만들기

## 1. 이 문서의 역할

이 문서는 2권이다.

1권에서 타입과 큰 그림을 익혔다면, 이제 실제 워크플로우의 가장 앞부분을 구현한다.

이번 권의 목표는 두 가지다.

1. 사용자 입력을 내부 표준 입력으로 바꾸는 법을 익힌다.
2. planner가 만든 섹션 계획을 어떻게 실행 그룹으로 나눌지 감을 잡는다.

즉, 이번 권은 “무엇을 만들 것인가”가 아니라 “무엇을 만들 준비를 어떻게 할 것인가”를 구현하는 단계다.

### 💡 왜 입력을 정규화하는가? (Why?)
사용자는 "이런 문서 써줘"라고 아주 막연하게 요청할 수도 있고, 수백 줄의 요구사항을 보낼 수도 있다.
- **불확실성 제거**: LLM은 입력이 명확할수록 결과가 좋아진다. 막연한 요청을 "주제, 독자, 목적, 형식"으로 쪼개어 시스템이 다루기 쉬운 상태로 만든다.
- **디폴트 값 제공**: 사용자가 생략한 정보(예: "독자층")를 AI가 추론해서 채워넣어, 이후 단계인 Planner가 멈추지 않게 한다.

### 🚀 분석된 결과의 미래 역할 (Role)
- **플래너의 영양분**: `NormalizedDocumentRequest`는 3권에서 `Planner`가 목차를 설계하는 데 쓰이는 "설계 요약서"가 된다.
- **실행의 지도**: `ExecutionPlan`은 문서의 어떤 부분을 먼저 쓰고 어떤 부분을 나중에 쓸지(병렬/순차) 결정하는 "작전 지도"가 된다.

---

## 2. 이번 권에서 다룰 파일

- [`src/application/services/request-analyzer.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/request-analyzer.ts)
- [`src/application/services/execution-planner-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/execution-planner-service.ts)
- [`src/shared/utils/ids.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/shared/utils/ids.ts)
- [`src/shared/utils/text.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/shared/utils/text.ts)
- [`src/shared/utils/arrays.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/shared/utils/arrays.ts)
- [`src/shared/utils/asserts.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/shared/utils/asserts.ts)
- [`src/domain/constants/quality-rules.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/constants/quality-rules.ts)

---

## 3. 먼저 이해할 개념

이번 권의 핵심은 “앞단 정리”다.

앞단 정리가 중요한 이유는 이렇다.

- analyzer가 약하면 planner가 입력 보정까지 떠안는다.
- execution planner가 약하면 병렬 실행이 무질서해진다.
- 유틸과 상수가 약하면 하위 구현이 파일마다 흔들린다.

즉, 이번 권은 뒤에서 더 복잡한 문제를 풀기 위해 바닥을 평평하게 만드는 단계다.

---

## 4. 직접 타이핑 순서

### 4.1 상수와 유틸부터 친다

먼저 아래 파일을 친다.

- [`src/domain/constants/quality-rules.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/constants/quality-rules.ts)
- [`src/shared/utils/asserts.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/shared/utils/asserts.ts)
- [`src/shared/utils/ids.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/shared/utils/ids.ts)
- [`src/shared/utils/text.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/shared/utils/text.ts)
- [`src/shared/utils/arrays.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/shared/utils/arrays.ts)

왜 이 순서인가:

- analyzer와 execution planner는 작은 유틸 의존성이 생기기 쉽다.
- 공통 기반을 먼저 타이핑하면 뒤 구현에서 집중력이 덜 분산된다.

생각해볼 질문:

- 한글 문서에서 word count를 어떻게 정의할 것인가?
- 섹션 ID는 단순 숫자보다 의미 있는 prefix가 필요할까?
- `assertCondition`은 어디까지 허용하고 어디서부터 validator가 되어야 할까?

직접 타이핑 코드:

```ts
// src/domain/constants/quality-rules.ts
export const DEFAULT_OUTLINE_SECTION_MIN = 5;
export const DEFAULT_OUTLINE_SECTION_MAX = 9;
export const DEFAULT_PATCH_ATTEMPT_LIMIT = 2;
```

```ts
// src/shared/utils/asserts.ts
export function assertCondition(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
```

```ts
// src/shared/utils/ids.ts
export function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${random}`;
}
```

```ts
// src/shared/utils/text.ts
export function countWords(text: string): number {
  const normalized = text.trim();

  if (!normalized) {
    return 0;
  }

  return normalized.split(/\s+/).length;
}
```

```ts
// src/shared/utils/arrays.ts
export function groupBy<TItem, TKey extends string>(
  items: TItem[],
  getKey: (item: TItem) => TKey,
): Record<TKey, TItem[]> {
  const result = {} as Record<TKey, TItem[]>;

  for (const item of items) {
    const key = getKey(item);
    result[key] ??= [];
    result[key].push(item);
  }

  return result;
}
```

### 4.2 `request-analyzer.ts`

이제 analyzer를 친다.

핵심 역할:

- 누락 필드에 기본값을 채운다.
- 위험한 입력을 방어한다.
- planner가 바로 사용할 수 있는 `NormalizedDocumentRequest`를 반환한다.

직접 구현할 때 집중할 것:

- `purpose`, `audience`, `format`이 비어 있을 때 어떤 기본 전략을 쓸지
- `targetLength`를 이후 section 길이 정책과 어떻게 이어줄지
- 입력 보정과 입력 거절의 기준을 어디에 둘지

스스로 답할 질문:

- analyzer는 “정규화”만 해야 할까, “추론”도 해야 할까?
- 너무 많은 기본값 보정은 사용자 의도를 왜곡하지 않을까?

직접 타이핑 코드:

```ts
// src/application/services/request-analyzer.ts
import type {
  CreateDocumentRequest,
  NormalizedDocumentRequest,
} from "../../domain/types/request.ts";

export async function analyzeRequest(
  request: CreateDocumentRequest,
): Promise<NormalizedDocumentRequest> {
  const topic = request.topic.trim();

  if (!topic) {
    throw new Error("topic은 비어 있을 수 없습니다.");
  }

  return {
    topic,
    purpose: request.purpose?.trim() || "주제를 구조적이고 충분히 자세한 문서로 정리한다.",
    audience: request.audience?.trim() || "기술 문서를 읽는 개발자",
    format: request.format ?? "technical-design",
    tone: request.tone ?? "formal",
    targetLength: request.targetLength ?? "medium",
    requiredSections: request.requiredSections ?? [],
    constraints: request.constraints ?? [],
  };
}
```

### 4.3 `execution-planner-service.ts`

이제 실행 그룹 계산기를 친다.

핵심 역할:

- `SectionBrief[]`를 받아 실제 실행 그룹으로 바꾼다.
- dependency를 존중하면서 병렬 가능한 섹션을 묶는다.

직접 구현할 때 집중할 것:

- `dependencies`가 없는 섹션을 어떻게 그룹화할지
- `parallelizable`이 false일 때 어떻게 예외 처리할지
- introduction/conclusion 같은 특수 섹션을 여기서 다룰지 상위에서 다룰지

스스로 답할 질문:

- 지금 이 단계에서 DAG 검증까지 할 필요가 있을까?
- 간단한 구현으로 시작한다면 어떤 제약을 두는 것이 좋을까?

직접 타이핑 코드:

```ts
// src/application/services/execution-planner-service.ts
import type {
  ExecutionGroup,
  SectionBrief,
} from "../../domain/types/planner.ts";

export function buildExecutionGroups(
  sections: SectionBrief[],
): ExecutionGroup[] {
  const ready = sections.filter(
    (section) => section.dependencies.length === 0 && section.parallelizable,
  );

  const blocked = sections.filter(
    (section) => section.dependencies.length > 0 || !section.parallelizable,
  );

  const groups: ExecutionGroup[] = [];

  if (ready.length > 0) {
    groups.push({
      id: "group-ready",
      sectionIds: ready.map((section) => section.id),
      mode: "parallel",
      reason: "선행 의존성이 없는 섹션들",
    });
  }

  for (const section of blocked) {
    groups.push({
      id: `group-${section.id}`,
      sectionIds: [section.id],
      mode: "sequential",
      reason: "의존성이 있거나 병렬 실행이 비활성화된 섹션",
    });
  }

  return groups;
}
```

---

## 5. 구현 포인트

이번 권의 핵심은 “화려한 로직”이 아니다.

중요한 것은 아래 세 가지다.

- 입력이 정돈되었는가
- 실행 순서가 예측 가능한가
- 뒤 단계가 불필요한 방어 로직을 덜 가지게 되었는가

즉, analyzer와 execution planner는 똑똑해 보이는 것보다 **다음 단계가 덜 불안해지도록 만드는 것**이 더 중요하다.

---

## 6. 직접 타이핑할 때 추천 루틴

1. 먼저 TODO 주석을 읽는다.
2. 바로 함수 본문을 다 채우지 않는다.
3. 입력과 반환 타입을 다시 한 번 눈으로 확인한다.
4. 가장 단순한 정상 케이스를 먼저 구현한다.
5. 그다음 예외 케이스를 붙인다.

이 순서를 지키면 처음부터 과설계하는 실수를 줄일 수 있다.

---

## 7. 스스로 점검할 질문

- analyzer가 planner의 부담을 실제로 줄여주고 있는가?
- execution planner의 결과를 사람이 읽었을 때도 납득 가능한가?
- 유틸이 shared여야 할 만큼 일반적인가, 아니면 특정 서비스 전용인가?
- 다음 단계인 planner 구현을 시작할 준비가 되었는가?

---

## 8. 다음 문서로 넘어가기 전 완료 조건

- `analyzeRequest`가 일관된 `NormalizedDocumentRequest`를 반환한다.
- `buildExecutionGroups`가 기본적인 의존성/병렬성 계산을 할 수 있다.
- 공통 유틸과 상수가 최소 수준으로 정리되어 있다.
- 이제 planner가 어떤 입력을 받고 어떤 실행 그룹과 연결될지 머릿속에 보인다.

다음 문서: [`docs/implementation-guide-03-planner.md`](/Users/NWZ-leejss/projects/personal/document-agent/docs/implementation-guide-03-planner.md)
