# Planner-Executor 구현 체크리스트

## 1. 문서 목적

이 문서는 현재 생성된 스켈레톤 코드를 기준으로, 개발자가 **어떤 순서로 어떤 파일부터 직접 구현하면 좋은지** 안내하는 학습용 체크리스트다.

대상 독자는 다음과 같다.

- 설계 문서를 읽고 이제 직접 구현을 시작하려는 개발자
- 한 번에 전부 구현하기보다, 책임 경계를 이해하면서 단계별로 만들고 싶은 개발자

이 문서는 구현 순서를 제안하지만, 실제 세부 로직은 의도적으로 비워 두었다. 핵심 고민은 개발자가 먼저 하도록 설계했다.

---

## 2. 먼저 읽을 문서

구현 전에 아래 문서를 먼저 읽는 것을 권장한다.

1. [`PRD.md`](/Users/NWZ-leejss/projects/personal/document-agent/PRD.md)
2. [`docs/planner-executor-design.md`](/Users/NWZ-leejss/projects/personal/document-agent/docs/planner-executor-design.md)

그다음 실제 코드 스켈레톤을 아래 순서로 훑어보면 좋다.

1. [`src/domain/types/request.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/request.ts)
2. [`src/domain/types/planner.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/planner.ts)
3. [`src/domain/types/section.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/section.ts)
4. [`src/domain/types/review.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/review.ts)
5. [`src/application/services/document-orchestrator.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/document-orchestrator.ts)

---

## 3. 권장 구현 순서 요약

전체 권장 순서는 아래와 같다.

1. 공통 타입과 상수 이해
2. 공통 유틸 구현
3. Request Analyzer 구현
4. Execution Planner 구현
5. Planner 구현
6. Section Writer 구현
7. Intro/Conclusion Writer 구현
8. Editor 구현
9. Reviewer 구현
10. Patch 구현
11. Logger와 Clock 같은 인프라 기본 구현
12. Orchestrator 구현
13. 마지막에 실제 LLM 클라이언트와 프롬프트 구체화

### 왜 이 순서인가

- 앞 단계가 뒤 단계의 입력 계약을 결정한다.
- planner보다 먼저 타입과 유틸이 안정되어야 구현이 덜 흔들린다.
- orchestrator를 너무 먼저 구현하면 하위 서비스 경계가 흐려진다.
- 실제 LLM 연결은 제일 마지막에 붙여도 된다.

---

## 4. 단계별 체크리스트

## 4.1 1단계: 타입과 상태 모델 완전히 이해하기

### 대상 파일

- [`src/domain/types/request.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/request.ts)
- [`src/domain/types/planner.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/planner.ts)
- [`src/domain/types/section.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/section.ts)
- [`src/domain/types/review.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/review.ts)
- [`src/domain/types/runtime.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/runtime.ts)
- [`src/domain/types/document.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/document.ts)

### 체크리스트

- `CreateDocumentRequest`와 `NormalizedDocumentRequest`의 차이를 설명할 수 있다.
- `PlannerResult`가 어떤 단계의 출력인지 설명할 수 있다.
- `SectionDraft.status`와 `SectionRuntimeState.status`의 차이를 설명할 수 있다.
- `ReviewResult`가 왜 patch 가능한 정보까지 포함해야 하는지 설명할 수 있다.
- `DocumentRuntimeState`가 왜 필요한지 설명할 수 있다.

### 구현 전 고민

- “이 타입은 사용자 입력인가, 내부 처리용인가, 최종 결과용인가?”
- “이 상태는 실행 상태인가, 산출물 품질 상태인가?”
- “나중에 patch/retry가 붙어도 이 타입이 버틸까?”

### 완료 기준

- 각 타입의 역할을 말로 설명할 수 있다.
- 필요하다면 필드명 정도만 소폭 수정하되, 책임 경계는 유지한다.

---

## 4.2 2단계: 공통 유틸부터 구현하기

### 대상 파일

- [`src/shared/utils/ids.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/shared/utils/ids.ts)
- [`src/shared/utils/text.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/shared/utils/text.ts)
- [`src/shared/utils/arrays.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/shared/utils/arrays.ts)
- [`src/shared/utils/asserts.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/shared/utils/asserts.ts)
- [`src/domain/constants/quality-rules.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/constants/quality-rules.ts)

### 체크리스트

- 섹션 ID 생성 규칙을 정한다.
- 단어 수 계산 정책을 정한다.
- 배열 그룹핑/정렬에 필요한 최소 유틸을 만든다.
- 런타임 invariant 검증 방식(`assert` vs validator)을 정한다.

### 구현 전 고민

- 한글 문서에서 “word count”를 어떤 규칙으로 볼 것인가?
- `assertCondition`은 실패 시 에러를 던질지, 커스텀 에러를 만들지?
- 지금 필요한 유틸만 만들고 있는가, 아니면 과하게 일반화하고 있는가?

### 완료 기준

- 이후 서비스 구현에서 복붙 없이 재사용 가능한 최소 유틸이 생긴다.
- 타입 체크와 간단한 단위 테스트를 붙일 수 있다.

---

## 4.3 3단계: Request Analyzer 구현하기

### 대상 파일

- [`src/application/services/request-analyzer.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/request-analyzer.ts)

### 체크리스트

- 누락 필드 기본값을 정의한다.
- 입력 검증 규칙을 정한다.
- `short/medium/long` 같은 길이 수준을 내부 정책으로 연결한다.
- 분석 결과가 planner에 바로 들어갈 수 있는지 확인한다.

### 구현 전 고민

- 기본값은 보수적으로 둘지, 적극적으로 보정할지?
- 잘못된 입력은 조용히 보정할지, 에러를 낼지?
- `audience`, `purpose`, `format`이 비어 있을 때 어떤 전략이 자연스러운가?

### 완료 기준

- `CreateDocumentRequest`를 받아 항상 일관된 `NormalizedDocumentRequest`를 반환한다.
- planner가 “입력 부족” 때문에 복잡해지지 않는다.

---

## 4.4 4단계: Execution Planner 구현하기

### 대상 파일

- [`src/application/services/execution-planner-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/execution-planner-service.ts)

### 체크리스트

- `dependencies`를 읽어 실행 순서를 계산한다.
- 병렬 가능한 섹션 묶음을 만든다.
- 순차 실행이 필요한 섹션을 구분한다.
- 잘못된 dependency 조합을 탐지할지 결정한다.

### 구현 전 고민

- 정말 DAG 검증이 필요한가?
- `parallelizable=false`인데 dependency가 없는 경우는 어떻게 처리할까?
- intro/conclusion은 이 서비스에서 제외할까, 포함할까?

### 완료 기준

- 입력 섹션 목록으로부터 `ExecutionGroup[]`를 안정적으로 계산한다.
- 단순한 예시 케이스를 손으로 그렸을 때 결과가 직관과 맞는다.

---

## 4.5 5단계: Planner 구현하기

### 대상 파일

- [`src/application/services/planner-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/planner-service.ts)
- [`src/agents/prompts/planner.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/planner.ts)
- [`src/agents/mappers/llm-result-mapper.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/mappers/llm-result-mapper.ts)

### 체크리스트

- `GlobalDocumentBrief`를 채우는 규칙을 정한다.
- 아웃라인 섹션 수를 5~9 범위 안에서 설계하도록 유도한다.
- 각 `SectionBrief`에 purpose, keyPoints, requiredElements, minWordCount가 채워지게 한다.
- `ExecutionGroup` 계산과 연결한다.

### 구현 전 고민

- planner가 `executionGroups`까지 직접 만들까, 아니면 생성 후 별도 서비스에 맡길까?
- `requiredSections`를 제목 수준으로 반영할지, keyPoints 수준으로 녹일지?
- planner 출력이 추상적일 때 어디서 sanity check를 할까?

### 완료 기준

- planner 결과만 봐도 어떤 문서가 나올지 상상 가능하다.
- `SectionBrief`가 section writer의 입력으로 바로 쓸 수 있을 만큼 구체적이다.

---

## 4.6 6단계: Section Writer 구현하기

### 대상 파일

- [`src/application/services/section-writer-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/section-writer-service.ts)
- [`src/agents/prompts/section-writer.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/section-writer.ts)

### 체크리스트

- 단일 섹션 초안 생성 로직을 만든다.
- `minWordCount` 충족 여부를 검증한다.
- `requiredElements`가 실제 본문에 반영되도록 설계한다.
- `relatedSections`를 활용해 중복 회피 전략을 정한다.

### 구현 전 고민

- 길이 보장은 프롬프트만으로 충분한가, 후처리 검증이 필요한가?
- 관련 섹션 컨텍스트를 얼마나 넣어야 중복은 줄고 토큰 낭비는 줄일 수 있을까?
- 실패 시 동일 입력 재시도와 수정 입력 재시도 중 어느 쪽이 좋을까?

### 완료 기준

- 한 섹션 단위로 독립 테스트가 가능하다.
- 섹션 실패가 전체 시스템 실패가 되지 않도록 다룰 수 있다.

---

## 4.7 7단계: Intro/Conclusion Writer 구현하기

### 대상 파일

- [`src/application/services/intro-writer-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/intro-writer-service.ts)
- [`src/application/services/conclusion-writer-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/conclusion-writer-service.ts)

### 체크리스트

- 서론 작성 시 outline과 본문 draft 중 무엇을 우선할지 정한다.
- 결론 작성 시 요약만 할지, 행동 제안까지 포함할지 정한다.
- 서론/결론이 body 섹션과 톤이 어긋나지 않게 한다.

### 구현 전 고민

- 서론은 초기에 쓸까, body 초안 이후에 쓸까?
- patch 이후 결론을 다시 써야 하는가?
- intro/conclusion을 일반 section writer로 통합할지, 별도 서비스로 둘지?

### 완료 기준

- 서론과 결론이 전체 문서 흐름을 강화하는 역할을 한다.
- body 작성과의 책임 경계가 분명하다.

---

## 4.8 8단계: Editor 구현하기

### 대상 파일

- [`src/application/services/editor-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/editor-service.ts)
- [`src/agents/prompts/editor.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/editor.ts)

### 체크리스트

- 섹션 병합 순서를 outline 기준으로 고정한다.
- 용어 통일 규칙을 적용한다.
- 중복 제거와 연결 문장 추가를 한다.
- 길이 후퇴가 과하지 않은지 점검한다.

### 구현 전 고민

- editor는 문장을 다듬는 단계인가, 구조까지 손대는 단계인가?
- glossary 기반 정규화를 여기서 할까?
- 정보를 줄이지 않고 중복만 줄이는 검증은 어떻게 할까?

### 완료 기준

- 병렬 생성된 섹션이 하나의 사람이 쓴 것처럼 읽힌다.
- 편집 후 문서가 너무 짧아지지 않는다.

---

## 4.9 9단계: Reviewer 구현하기

### 대상 파일

- [`src/application/services/reviewer-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/reviewer-service.ts)
- [`src/agents/prompts/reviewer.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/reviewer.ts)

### 체크리스트

- 필수 섹션 포함 여부를 검사한다.
- 섹션별 최소 분량을 점검한다.
- 논리 흐름과 독자 적합성 문제를 찾는다.
- `weakSections`를 구체적으로 반환한다.

### 구현 전 고민

- reviewer score를 어떤 척도로 산출할까?
- 정적 규칙과 LLM 판단을 어떻게 섞을까?
- “모호하다” 같은 피드백을 patch 가능한 문장으로 어떻게 바꿀까?

### 완료 기준

- pass/fail만이 아니라, 실제 수정 방향이 담긴 `ReviewResult`를 반환한다.
- patch 서비스가 reviewer 결과만 보고도 움직일 수 있다.

---

## 4.10 10단계: Patch 구현하기

### 대상 파일

- [`src/application/services/patch-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/patch-service.ts)
- [`src/agents/prompts/patch.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/patch.ts)

### 체크리스트

- 특정 섹션만 선택 수정할 수 있게 한다.
- `PatchRequest`를 실제 수정 지시로 바꾼다.
- 패치 후 결과를 다시 editor/reviewer로 보낼지 정한다.

### 구현 전 고민

- patch는 기존 문장을 부분 수정할까, 섹션 전체를 다시 쓸까?
- 여러 약점이 한 섹션에 몰리면 한 번에 처리할까, 쪼갤까?
- patch 횟수 제한은 어디서 강제할까?

### 완료 기준

- 전체 문서를 다시 만들지 않고도 약한 섹션을 보강할 수 있다.
- reviewer와 자연스럽게 연결된다.

---

## 4.11 11단계: Logger, Clock, 기본 인프라 구현하기

### 대상 파일

- [`src/application/ports/logger.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/ports/logger.ts)
- [`src/application/ports/clock.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/ports/clock.ts)
- [`src/infrastructure/logging/console-logger.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/infrastructure/logging/console-logger.ts)

### 체크리스트

- 최소 로그 포맷을 정한다.
- 시간 생성 방식을 추상화한다.
- 테스트 가능한 형태로 의존성을 주입한다.

### 구현 전 고민

- 로그를 단순 콘솔 출력으로 시작해도 충분한가?
- 타임스탬프는 `Clock` 포트로 감싸는 편이 테스트에 유리한가?

### 완료 기준

- 서비스들이 직접 `console.log`나 `new Date()`에 묶이지 않는다.

---

## 4.12 12단계: Orchestrator 구현하기

### 대상 파일

- [`src/application/services/document-orchestrator.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/document-orchestrator.ts)
- [`src/domain/types/runtime.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/runtime.ts)

### 체크리스트

- analyzer -> planner -> section writers -> intro/conclusion -> editor -> reviewer -> patch 순서를 연결한다.
- `DocumentRuntimeState`를 업데이트한다.
- 단계별 로그를 남긴다.
- 실패/재시도/부분 성공 정책을 구현한다.

### 구현 전 고민

- 어느 단계 실패가 전체 실패여야 하는가?
- patch는 기본 1회만 돌릴까?
- 병렬 섹션 작성 결과를 어떤 순서로 합칠까?

### 완료 기준

- 전체 워크플로우를 한 함수에서 추적할 수 있다.
- 하위 서비스 책임을 침범하지 않는다.

---

## 4.13 13단계: 실제 LLM 클라이언트와 프롬프트 마무리하기

### 대상 파일

- [`src/application/ports/llm-client.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/ports/llm-client.ts)
- [`src/infrastructure/llm/openai-llm-client.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/infrastructure/llm/openai-llm-client.ts)
- [`src/agents/prompts/planner.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/planner.ts)
- [`src/agents/prompts/section-writer.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/section-writer.ts)
- [`src/agents/prompts/editor.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/editor.ts)
- [`src/agents/prompts/reviewer.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/reviewer.ts)
- [`src/agents/prompts/patch.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/patch.ts)

### 체크리스트

- 텍스트 생성과 구조화 출력을 구분해 연결한다.
- 프롬프트별 출력 형식을 명확히 한다.
- 구조화 응답 파싱 실패 시 대처 전략을 정한다.

### 구현 전 고민

- 어떤 단계가 구조화 응답을 강제해야 하는가?
- 프롬프트는 재사용성을 우선할까, 단계별 특화성을 우선할까?
- 벤더 종속 로직이 application 계층으로 새지 않는가?

### 완료 기준

- 포트는 그대로 두고 구현체만 갈아끼울 수 있다.
- 프롬프트와 서비스 책임이 섞이지 않는다.

---

## 5. 추천 구현 단위

한 번에 너무 크게 구현하지 않으려면 아래 묶음으로 진행하는 것이 좋다.

### 묶음 A

- `types`
- `shared/utils`
- `quality-rules`

### 묶음 B

- `request-analyzer`
- `execution-planner-service`

### 묶음 C

- `planner-service`
- `planner prompt`
- `result mapper`

### 묶음 D

- `section-writer-service`
- `intro/conclusion writer`

### 묶음 E

- `editor-service`
- `reviewer-service`
- `patch-service`

### 묶음 F

- `document-orchestrator`
- `logger`
- `llm client`
- `src/index.ts`

---

## 6. 각 단계마다 공통으로 확인할 것

- 이 로직은 정말 이 파일 책임이 맞는가?
- 타입이 구현을 설명해 주고 있는가?
- 실패 시나리오가 드러나는가?
- 나중에 테스트하기 쉬운가?
- orchestrator가 하위 서비스 내부 로직을 너무 많이 알아야 하지는 않는가?

---

## 7. 구현 중 피해야 할 실수

- planner를 목차 생성기로만 구현하는 것
- section writer에 editor 책임까지 밀어 넣는 것
- reviewer를 pass/fail 판정기 정도로만 끝내는 것
- patch를 전체 재생성처럼 구현하는 것
- orchestrator에서 모든 세부 정책을 하드코딩하는 것
- 타입보다 구현을 먼저 키워서 상태 모델이 뒤늦게 흔들리는 것

---

## 8. 첫 구현 스프린트 권장 범위

학습 목적이라면 첫 스프린트는 아래까지만 구현해도 충분하다.

1. 유틸 구현
2. request analyzer 구현
3. execution planner 구현
4. planner 구현
5. planner 결과를 콘솔에서 확인할 수 있는 최소 흐름

이 정도면 “이 시스템이 어떤 구조로 돌아가는지”를 체감할 수 있고, 아직 section writing/editor/reviewer의 난이도 높은 부분은 뒤로 미룰 수 있다.

---

## 9. 최종 요약

가장 좋은 구현 순서는 “가장 중요한 것부터”가 아니라, **뒤 단계의 전제를 먼저 고정하는 순서**다.

그래서 이 프로젝트는 아래 순서가 가장 안정적이다.

1. 타입과 유틸
2. 입력 정규화
3. 구조 설계(planner)
4. 섹션 생성
5. 통합과 품질 점검
6. 전체 오케스트레이션
7. 마지막에 실제 LLM 연결

이 문서를 따라가면, 구현을 빨리 끝내기보다 각 계층의 책임을 제대로 이해하면서 코드베이스를 키울 수 있다.
