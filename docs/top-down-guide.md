# Planner-Executor 탑다운 이해 및 구현 가이드

## 1. 문서 목적

이 문서는 현재 코드베이스를 **탑다운(top-down)** 방식으로 이해하고, 그 이해를 바탕으로 직접 구현까지 이어가기 위한 학습 가이드다.

여기서 탑다운 방식이란 아래 순서를 뜻한다.

1. 시스템이 전체적으로 무엇을 하려는지 먼저 이해한다.
2. 큰 책임 단위를 나눈다.
3. 각 책임 단위가 어떤 입력과 출력을 가지는지 본다.
4. 마지막에 세부 구현 로직과 유틸로 내려간다.

이 방식은 처음부터 유틸 함수나 타입 디테일에 매몰되지 않게 해 준다. 특히 지금처럼 스켈레톤 코드만 있고 핵심 구현은 비어 있는 프로젝트에서는, 탑다운 접근이 가장 학습 효율이 좋다.

---

## 2. 먼저 가져야 할 큰 그림

이 프로젝트는 “문서를 생성하는 함수 모음”이 아니라, **문서 작성 과정을 여러 단계로 분해한 워크플로우 시스템**이다.

가장 먼저 이해해야 할 흐름은 이것이다.

```text
입력 정리
-> 문서 구조 설계
-> 섹션별 초안 생성
-> 서론/결론 보강
-> 전체 문서 편집
-> 품질 검토
-> 약한 부분만 패치
-> 최종 문서 반환
```

이 흐름을 기준으로 보면, 코드는 크게 다섯 층으로 나뉜다.

1. 진입점
2. 오케스트레이션 계층
3. 단계별 서비스 계층
4. 도메인 타입 계층
5. 인프라/프롬프트/유틸 계층

탑다운 학습은 반드시 이 순서를 유지하는 것이 좋다.

---

## 3. 1단계: 진입점부터 본다

### 먼저 볼 파일

- [`index.ts`](/Users/NWZ-leejss/projects/personal/document-agent/index.ts)
- [`src/index.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/index.ts)

### 여기서 이해할 것

- 프로젝트가 외부에 어떤 API를 노출하려는지
- “실행 코드”보다 “구조 노출”이 현재 목적이라는 점
- 실제 핵심 로직은 `src/application/services` 아래에 있다는 점

### 스스로 답해볼 질문

- 이 프로젝트의 public entry는 무엇인가?
- 지금 루트 `index.ts`는 실행용인가, 재노출용인가?
- 외부 사용자는 어떤 함수부터 호출하게 될까?

### 학습 포인트

현재 진입점은 일부러 얇다. 이것은 좋은 신호다. 진입점이 복잡하면 책임 분리가 무너졌을 가능성이 높다. 탑다운 관점에서는 “맨 위 파일이 얼마나 단순한가”를 먼저 보는 것이 좋다.

---

## 4. 2단계: 오케스트레이터를 본다

### 먼저 볼 파일

- [`src/application/services/document-orchestrator.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/document-orchestrator.ts)

### 왜 이 파일을 먼저 보는가

이 파일은 시스템 전체의 “감독” 역할을 한다. 모든 디테일을 여기서 구현하면 안 되지만, 전체 단계가 어떤 순서로 연결되는지는 여기서 가장 잘 보인다.

### 여기서 이해할 것

- 어떤 단계가 존재하는가
- 어떤 단계가 어떤 단계보다 먼저 실행되어야 하는가
- 어떤 결과물이 다음 단계의 입력이 되는가
- 실패, 재시도, 부분 성공을 어디서 조정할 것인가

### 스스로 답해볼 질문

- 이 시스템의 핵심 단계는 몇 개인가?
- planner보다 먼저 section writer를 호출할 수 없는 이유는 무엇인가?
- patch는 왜 마지막 근처에 위치하는가?
- orchestrator가 하위 서비스의 세부 로직까지 알면 왜 나빠지는가?

### 구현할 때 주의할 점

- 이 파일에 business logic를 너무 많이 넣지 않는다.
- 여기서는 “순서”와 “상태 전이”를 다루고, 내용 생성 규칙은 하위 서비스에 맡긴다.
- `DocumentRuntimeState`를 어떻게 업데이트할지 먼저 생각하고 구현하는 편이 좋다.

---

## 5. 3단계: 서비스 계층을 단계 순서대로 본다

탑다운 방식에서는 서비스 파일을 아무 순서로나 읽지 않는다. 실제 워크플로우 순서대로 내려가야 이해가 더 잘 된다.

### 3.1 Request Analyzer

#### 파일

- [`src/application/services/request-analyzer.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/request-analyzer.ts)

#### 이해 포인트

- 사용자 입력을 내부 표준 입력으로 바꾸는 단계다.
- planner가 복잡해지지 않게 앞단에서 입력을 정리하는 역할이다.

#### 질문

- 어떤 필드는 기본값을 채워야 하는가?
- 어떤 입력 오류는 허용하고, 어떤 오류는 막아야 하는가?
- “입력 정규화”와 “입력 해석”은 어디까지 같은 문제인가?

### 3.2 Planner

#### 파일

- [`src/application/services/planner-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/planner-service.ts)
- [`src/agents/prompts/planner.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/planner.ts)

#### 이해 포인트

- 이 시스템의 품질 상한선은 planner가 거의 결정한다.
- planner는 단순 목차 생성기가 아니라, 섹션 목적과 경계를 정의하는 설계자다.

#### 질문

- 좋은 섹션 brief는 무엇을 반드시 포함해야 하는가?
- `requiredSections`는 section title에 반영할까, keyPoints에 반영할까?
- planner 출력이 부실하면 어느 계층에서 방어해야 하는가?

### 3.3 Execution Planner

#### 파일

- [`src/application/services/execution-planner-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/execution-planner-service.ts)

#### 이해 포인트

- planner가 만든 section dependency를 실제 실행 그룹으로 바꾸는 단계다.
- 병렬 실행은 성능 문제이기도 하지만, 더 중요하게는 “의존성 보존” 문제다.

#### 질문

- dependency가 없는 섹션은 모두 병렬이어야 하는가?
- `parallelizable` 정책은 planner가 결정할까, execution planner가 다시 판단할까?
- intro/conclusion은 이 흐름에 포함할까, 별도 경로로 뺄까?

### 3.4 Section Writer

#### 파일

- [`src/application/services/section-writer-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/section-writer-service.ts)
- [`src/agents/prompts/section-writer.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/section-writer.ts)

#### 이해 포인트

- 섹션 하나를 독립 산출물로 만드는 단계다.
- 품질 기준은 “예쁘게 쓰기”보다 “section brief 계약 만족”이 우선이다.

#### 질문

- `minWordCount`를 어떻게 검증할 것인가?
- `requiredElements`는 프롬프트에서 강제할까, 생성 후 검사할까?
- `relatedSections`는 얼마나 제공해야 적절한가?

### 3.5 Intro / Conclusion Writer

#### 파일

- [`src/application/services/intro-writer-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/intro-writer-service.ts)
- [`src/application/services/conclusion-writer-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/conclusion-writer-service.ts)

#### 이해 포인트

- 서론과 결론은 일반 body 섹션과 비슷해 보이지만 역할이 다르다.
- 이 둘은 문서의 전역 흐름과 독자 경험을 다루므로, 따로 분리할 가치가 있다.

#### 질문

- intro는 본문 초안 이전에 쓰는 것이 자연스러운가?
- conclusion은 reviewer 이전에 쓸까, 이후에 다시 쓸 수도 있을까?
- 별도 서비스로 두는 비용보다 얻는 이점이 큰가?

### 3.6 Editor

#### 파일

- [`src/application/services/editor-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/editor-service.ts)
- [`src/agents/prompts/editor.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/editor.ts)

#### 이해 포인트

- editor는 문서를 “짧게 만드는 단계”가 아니라 “하나로 통합하는 단계”다.
- 병렬 생성으로 생긴 톤 차이, 용어 차이, 중복 설명을 줄인다.

#### 질문

- editor가 구조까지 바꿔도 되는가?
- length regression은 어떤 기준으로 판단할까?
- glossary와 styleGuide를 실제로 어떻게 활용할까?

### 3.7 Reviewer

#### 파일

- [`src/application/services/reviewer-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/reviewer-service.ts)
- [`src/agents/prompts/reviewer.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/reviewer.ts)

#### 이해 포인트

- reviewer는 단순 판정기가 아니라 진단기다.
- 이 단계가 좋아야 patch가 의미 있는 수정을 할 수 있다.

#### 질문

- 정적 규칙과 LLM 평가를 어떻게 섞을까?
- `weakSections`는 얼마나 구체적이어야 patch가 바로 쓸 수 있을까?
- reviewer score는 내부 지표인가, 사용자에게 보일 값인가?

### 3.8 Patch

#### 파일

- [`src/application/services/patch-service.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/patch-service.ts)
- [`src/agents/prompts/patch.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/patch.ts)

#### 이해 포인트

- patch는 전체 재생성이 아니라 좁은 범위 수정이다.
- 이 단계가 있기에 사용자는 약한 섹션만 보강할 수 있다.

#### 질문

- patch는 기존 초안을 부분 수정할까, 섹션 전체를 다시 쓸까?
- patch 후 editor를 다시 호출해야 하는가?
- 패치 횟수 제한은 어디에서 강제하는가?

---

## 6. 4단계: 서비스가 공유하는 타입을 본다

서비스 흐름을 이해했다면, 이제 그들이 주고받는 데이터 구조를 읽어야 한다. 이 순서를 뒤집으면 타입이 단순 선언문처럼 보이기 쉽다. 하지만 서비스 흐름을 알고 나면, 타입이 왜 그렇게 생겼는지 보이기 시작한다.

### 먼저 볼 파일

- [`src/domain/types/request.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/request.ts)
- [`src/domain/types/planner.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/planner.ts)
- [`src/domain/types/section.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/section.ts)
- [`src/domain/types/review.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/review.ts)
- [`src/domain/types/runtime.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/runtime.ts)
- [`src/domain/types/document.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/types/document.ts)

### 탑다운으로 읽는 방법

1. `CreateDocumentRequest`와 `NormalizedDocumentRequest`를 본다.
2. `PlannerResult`, `OutlinePlan`, `SectionBrief`를 본다.
3. `SectionDraft`, `SectionRuntimeState`를 본다.
4. `ReviewResult`, `PatchRequest`, `PatchResult`를 본다.
5. 마지막에 `DocumentRuntimeState`와 `GeneratedDocumentResult`를 본다.

### 이 순서를 추천하는 이유

- 입력에서 시작해 계획으로 간다.
- 계획에서 실행 단위로 간다.
- 실행 단위에서 검토와 보강으로 간다.
- 마지막에 전역 상태와 최종 결과를 본다.

### 스스로 답해볼 질문

- 어떤 타입이 “단계 사이 계약” 역할을 하는가?
- 어떤 타입이 “상태 추적” 역할을 하는가?
- 어떤 타입이 “최종 산출물” 역할을 하는가?

---

## 7. 5단계: 프롬프트와 매퍼를 본다

### 먼저 볼 파일

- [`src/agents/prompts/planner.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/planner.ts)
- [`src/agents/prompts/section-writer.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/section-writer.ts)
- [`src/agents/prompts/editor.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/editor.ts)
- [`src/agents/prompts/reviewer.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/reviewer.ts)
- [`src/agents/prompts/patch.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/prompts/patch.ts)
- [`src/agents/mappers/llm-result-mapper.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/agents/mappers/llm-result-mapper.ts)

### 여기서 이해할 것

- 서비스는 “무엇을 원한다”를 정의하고,
- 프롬프트는 “LLM에게 어떻게 요청한다”를 정의하며,
- 매퍼는 “응답을 내부 타입으로 어떻게 정리한다”를 정의한다.

즉, 이 계층은 서비스와 LLM 사이의 번역층이다.

### 스스로 답해볼 질문

- 어떤 단계는 구조화 출력이 꼭 필요한가?
- 어떤 단계는 자유 텍스트만으로 충분한가?
- 프롬프트 파일에 business rule이 새어 나오고 있지 않은가?

### 구현할 때 주의할 점

- 서비스 로직과 프롬프트 로직을 섞지 않는다.
- 매퍼는 파싱과 최소한의 sanity check까지만 맡기는 편이 좋다.
- “프롬프트를 잘 쓰는 것”보다 “입출력 계약을 안정화하는 것”이 먼저다.

---

## 8. 6단계: 인프라 포트와 구현체를 본다

### 먼저 볼 파일

- [`src/application/ports/llm-client.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/ports/llm-client.ts)
- [`src/application/ports/logger.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/ports/logger.ts)
- [`src/application/ports/clock.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/ports/clock.ts)
- [`src/infrastructure/llm/openai-llm-client.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/infrastructure/llm/openai-llm-client.ts)
- [`src/infrastructure/logging/console-logger.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/infrastructure/logging/console-logger.ts)

### 여기서 이해할 것

- application 계층은 외부 세계를 interface로 본다.
- infrastructure 계층은 그 interface를 실제 구현으로 연결한다.
- 이 분리가 있어야 나중에 벤더 변경이나 테스트 대체가 쉽다.

### 스스로 답해볼 질문

- 왜 서비스가 직접 OpenAI SDK를 호출하면 안 좋을까?
- 왜 `Logger`와 `Clock`도 포트로 두는가?
- 테스트에서는 어떤 구현체를 넣고 싶을까?

---

## 9. 7단계: 마지막으로 유틸과 상수를 본다

### 먼저 볼 파일

- [`src/shared/utils/ids.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/shared/utils/ids.ts)
- [`src/shared/utils/text.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/shared/utils/text.ts)
- [`src/shared/utils/arrays.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/shared/utils/arrays.ts)
- [`src/shared/utils/asserts.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/shared/utils/asserts.ts)
- [`src/domain/constants/section-status.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/constants/section-status.ts)
- [`src/domain/constants/quality-rules.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/domain/constants/quality-rules.ts)

### 왜 마지막인가

탑다운 방식에서는 유틸을 먼저 보면 “이 함수가 왜 필요한지”가 안 보이기 쉽다. 반대로 상위 흐름을 먼저 이해한 뒤 유틸을 보면, 이 함수가 어느 계층을 돕는지 선명하게 보인다.

### 스스로 답해볼 질문

- 이 유틸이 정말 shared여야 하는가?
- 특정 서비스 전용 로직이 shared로 새어 나온 것은 아닌가?
- 지금 필요한 최소 유틸만 만들고 있는가?

---

## 10. 실제 구현도 탑다운으로 시작하는 방법

탑다운 이해가 끝났다고 해서, 구현도 반드시 orchestrator부터 쓰라는 뜻은 아니다. 이해는 위에서 아래로 하되, 구현은 “의존성이 적은 아래쪽부터” 시작하는 것이 보통 더 안전하다.

즉, 다음처럼 나누어 생각하면 좋다.

### 이해 순서

1. 진입점
2. 오케스트레이터
3. 서비스 흐름
4. 타입
5. 프롬프트/인프라
6. 유틸

### 구현 순서

1. 타입
2. 유틸
3. request analyzer
4. execution planner
5. planner
6. section writer
7. editor/reviewer/patch
8. orchestrator
9. 실제 LLM 인프라

이 차이를 이해하는 것이 중요하다.  
탑다운은 “어떻게 이해할 것인가”에 대한 전략이고, 구현 순서는 “어디부터 만드는 것이 덜 위험한가”에 대한 전략이다.

---

## 11. 추천 읽기 루틴

처음 프로젝트를 이해할 때는 아래 루틴을 추천한다.

1. [`PRD.md`](/Users/NWZ-leejss/projects/personal/document-agent/PRD.md)를 읽고 제품 목표를 이해한다.
2. [`docs/planner-executor-design.md`](/Users/NWZ-leejss/projects/personal/document-agent/docs/planner-executor-design.md)로 설계 의도를 본다.
3. [`docs/implementation-checklist.md`](/Users/NWZ-leejss/projects/personal/document-agent/docs/implementation-checklist.md)로 구현 순서를 본다.
4. [`src/application/services/document-orchestrator.ts`](/Users/NWZ-leejss/projects/personal/document-agent/src/application/services/document-orchestrator.ts)를 읽고 전체 흐름을 머릿속에 그린다.
5. 각 서비스 파일을 워크플로우 순서대로 읽는다.
6. 마지막에 타입과 유틸을 확인한다.

---

## 12. 처음 구현할 때 추천하는 질문

각 파일을 구현하기 전에 아래 질문을 먼저 적어보면 좋다.

- 이 파일의 책임은 한 문장으로 무엇인가?
- 이 파일은 누구의 입력을 받아 누구에게 출력을 넘기는가?
- 실패하면 누가 책임지고 복구하는가?
- 여기서 결정한 정책이 다른 계층을 오염시키지 않는가?
- 이 로직을 테스트하려면 어떤 의존성을 가짜로 바꾸고 싶을까?

이 질문에 답하지 못한 채 바로 구현하면, 대부분의 경우 서비스 경계가 흐려지기 시작한다.

---

## 13. 탑다운 방식의 흔한 실수

- 오케스트레이터를 읽고 바로 거기에 모든 로직을 넣는 것
- 타입을 “나중에 맞추면 되지” 하고 대충 넘기는 것
- 프롬프트를 먼저 다듬느라 서비스 책임 정의를 미루는 것
- 유틸부터 과하게 일반화해서 만드는 것
- patch/reviewer를 부가 기능처럼 보고 뒤늦게 억지로 붙이는 것

탑다운 방식은 “큰 그림을 먼저 본다”는 뜻이지, “상위 계층부터 바로 구현한다”는 뜻은 아니다.

---

## 14. 최종 요약

이 프로젝트를 탑다운으로 이해하는 가장 좋은 순서는 아래와 같다.

1. 시스템 전체 흐름을 본다.
2. 오케스트레이터로 단계 연결을 본다.
3. 서비스별 책임을 워크플로우 순서대로 본다.
4. 그다음 타입으로 데이터 흐름을 본다.
5. 마지막에 프롬프트, 인프라, 유틸을 본다.

그리고 실제 구현은 반대로, 더 작은 의존성부터 차근차근 쌓아 올리면 된다.

즉 이 프로젝트에서는 아래 두 문장을 같이 기억하면 된다.

- 이해는 위에서 아래로 한다.
- 구현은 아래에서 위로 올린다.

이 감각만 잡히면, 지금의 스켈레톤 구조가 왜 이렇게 나뉘어 있는지 훨씬 자연스럽게 읽히기 시작한다.
