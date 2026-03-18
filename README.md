# document-agent

`document-agent`는 Bun 기반 CLI로 긴 Markdown 문서를 생성하거나, 기존 문서의 특정 섹션만 다시 작성할 수 있는 문서 작성 에이전트입니다.

현재 구현은 "문서 계획 수립 -> 섹션 초안 작성 -> 문서 편집 -> 리뷰 -> 약한 섹션 보강" 흐름을 하나의 오케스트레이션 서비스로 묶은 MVP입니다.

## 한눈에 보기

| 항목 | 내용 |
|---|---|
| 실행 환경 | Bun |
| 주요 기능 | 새 문서 생성, 기존 문서 섹션 patch |
| 출력 형식 | Markdown |
| 실행 상태 저장 | SQLite (`.document-agent/document-agent.sqlite`) |
| 지원 LLM 공급자 | OpenAI, xAI, Anthropic |
| 핵심 진입점 | `src/index.ts` |

```text
사용자 요청
   |
   v
CLI 파싱
   |
   v
DocumentAgent
   |
   +--> planner -> 문서 아웃라인/섹션 계획
   +--> executor -> 섹션 초안 작성
   +--> editor -> 전체 Markdown 통합
   +--> reviewer -> 품질 점검
   +--> patcher -> 약한 섹션 재작성(필요 시)
   |
   +--> Markdown 파일 저장
   +--> SQLite 실행 이력 저장
```

## 현재 지원 기능

### 1. 문서 생성

입력 프롬프트를 바탕으로 문서 계획을 만들고, 섹션별 초안과 서론/결론을 생성한 뒤 최종 Markdown 문서를 완성합니다.

### 2. 섹션 단위 patch

기존 Markdown 문서에서 특정 헤딩 섹션만 골라 다시 작성하고, 해당 섹션만 교체해서 저장합니다.

### 3. 실행 이력 저장

문서 생성/patch 실행 정보, 계획, 섹션 초안, 리뷰 결과, 로그를 SQLite에 저장합니다.

## 설치와 실행

의존성 설치:

```bash
bun install
```

로컬에서 직접 실행:

```bash
bun run src/index.ts "planner-executor 설계 문서 작성해줘" --stdout
```

`package.json`의 `bin` 설정이 있으므로 패키지를 링크하거나 설치한 환경에서는 `doc-agent` 명령으로도 실행할 수 있습니다.

## CLI 사용법

### 문서 생성

```bash
bun run src/index.ts "ReAct 패턴 기술 문서 작성해줘" \
  --format guide \
  --audience "백엔드 엔지니어" \
  --purpose "설계 판단에 필요한 근거 제공" \
  --tone formal \
  --length long \
  --required-section "문제 정의" \
  --required-section "아키텍처" \
  --constraint "코드 예시 포함" \
  --parallel auto \
  --output ./out/react-guide.md
```

표준 출력으로만 확인:

```bash
bun run src/index.ts "scheduler 설계 문서 작성" --stdout
```

### 기존 문서 patch

```bash
bun run src/index.ts patch ./out/react-guide.md \
  --section "병렬 실행 전략" \
  --audience "플랫폼 엔지니어" \
  --length medium \
  --output ./out/react-guide-patched.md
```

## 지원 옵션

### 생성 명령

| 옵션 | 설명 |
|---|---|
| `--format <value>` | 문서 형식 지정 |
| `--audience <value>` | 대상 독자 지정 |
| `--purpose <value>` | 문서 목적 지정 |
| `--tone <value>` | 문체/톤 지정 |
| `--length <short\|medium\|long>` | 길이 힌트 지정 |
| `--required-section <value>` | 반드시 포함할 섹션. 여러 번 사용 가능 |
| `--constraint <value>` | 추가 제약 조건. 여러 번 사용 가능 |
| `--parallel <auto\|off>` | 섹션 병렬 실행 모드 |
| `--output <path>` | 결과 Markdown 저장 경로 |
| `--stdout` | 파일 저장 대신 stdout 출력 |
| `--verbose` | 상세 로그 출력 |

### patch 명령

| 옵션 | 설명 |
|---|---|
| `--section <title>` | 다시 작성할 섹션 제목. 필수 |
| `--format <value>` | 추가 문맥 힌트 |
| `--audience <value>` | 추가 독자 힌트 |
| `--purpose <value>` | 추가 목적 힌트 |
| `--tone <value>` | 추가 톤 힌트 |
| `--length <short\|medium\|long>` | 패치 길이 힌트 |
| `--required-section <value>` | 추가 제약 힌트. 여러 번 사용 가능 |
| `--constraint <value>` | 추가 제약 힌트. 여러 번 사용 가능 |
| `--parallel <auto\|off>` | patch 요청 구조상 허용되지만 기본값은 `off` |
| `--output <path>` | 패치 결과 저장 경로. 생략 시 원본 덮어씀 |
| `--stdout` | 결과 Markdown을 stdout으로 출력 |
| `--verbose` | 상세 로그 출력 |

## 환경 변수

| 이름 | 설명 |
|---|---|
| `LLM_PROVIDER` | `openai`, `xai`, `anthropic` 중 하나. 기본값은 `openai` |
| `OPENAI_API_KEY` | `LLM_PROVIDER=openai`일 때 필수 |
| `OPENAI_MODEL` | OpenAI 모델명. 기본값은 `gpt-5.2` |
| `XAI_API_KEY` | `LLM_PROVIDER=xai`일 때 필수 |
| `XAI_MODEL` | xAI 모델명. 기본값은 `grok-4-1-fast-reasoning` |
| `ANTHROPIC_API_KEY` | `LLM_PROVIDER=anthropic`일 때 필수 |
| `ANTHROPIC_MODEL` | Anthropic 모델명. 기본값은 `claude-sonnet-4-20250514` |

공급자 선택 흐름:

```text
LLM_PROVIDER
  |
  +-- openai    -> OpenAI Responses API
  +-- xai       -> OpenAI 호환 Responses API (baseURL: https://api.x.ai/v1)
  +-- anthropic -> Anthropic Messages API
```

## 저장 구조

최종 산출물과 실행 상태는 서로 다른 저장소에 보관됩니다.

| 저장 대상 | 저장 위치 | 설명 |
|---|---|---|
| 최종 문서 | Markdown 파일 | `--output` 경로 또는 patch 대상 경로 |
| 실행 메타데이터 | SQLite `documents` | 요청, 상태, 플랜, 리뷰, 최종 문서 |
| 섹션 초안 이력 | SQLite `section_runs` | 섹션별 draft와 patch 시도 기록 |
| 단계 로그 | SQLite `job_logs` | planner/executor/editor/reviewer 단계 로그 |

기본 DB 경로:

```text
.document-agent/document-agent.sqlite
```

## 아키텍처 설명

코드베이스는 비교적 전형적인 계층형 구조를 따릅니다.

```text
src
├─ domain
│  ├─ 문서 요청/계획/리뷰 타입
│  └─ 공통 에러와 정규화 규칙
├─ application
│  ├─ ports
│  │  ├─ LlmClient
│  │  ├─ DocumentRunRepository
│  │  └─ Logger
│  └─ services
│     ├─ cli-parser
│     ├─ document-agent
│     └─ scheduler
└─ infrastructure
   ├─ llm provider 구현체
   ├─ sqlite 저장소
   ├─ markdown 파일 저장소
   └─ 콘솔 로거
```

### 계층별 책임

| 계층 | 주요 파일 | 책임 |
|---|---|---|
| Entry | `src/index.ts` | CLI 명령 해석, 구현체 조립, 종료 코드 처리 |
| Domain | `src/domain/document.ts`, `src/domain/errors.ts` | 문서 생성에 필요한 타입, 기본값, 리뷰 보정, 공통 에러 |
| Application | `src/application/services/document-agent.ts` | 전체 생성/patch 워크플로 오케스트레이션 |
| Application | `src/application/services/cli-parser.ts` | argv를 `generate` 또는 `patch` 명령으로 변환 |
| Application | `src/application/services/scheduler.ts` | 섹션 dependency를 기준으로 실행 batch 계산 |
| Ports | `src/application/ports/*.ts` | 외부 의존성을 인터페이스로 추상화 |
| Infrastructure | `src/infrastructure/llm/*` | LLM 공급자별 API 연동과 프롬프트 생성 |
| Infrastructure | `src/infrastructure/persistence/sqlite-document-run-repository.ts` | 실행 상태와 이력 저장 |
| Infrastructure | `src/infrastructure/fs/markdown-store.ts` | Markdown 읽기/쓰기, 섹션 추출/치환 |
| Infrastructure | `src/infrastructure/logging/console-logger.ts` | 콘솔 로그 출력 |

### 생성 흐름 상세

`DocumentAgent.generate()`는 아래 순서로 동작합니다.

```text
Bun CLI
  |
  v
src/index.ts
  |
  +-- parseArgv()
  |
  +-- createLlmClient()
  +-- new SqliteDocumentRunRepository()
  +-- new MarkdownStore()
  +-- new ConsoleLogger()
  |
  v
DocumentAgent.generate()
  |
  +-- normalizeRequest()
  +-- repository.createDocumentRun()
  +-- llm.planDocument()
  +-- repository.savePlan()
  +-- buildExecutionBatches()
  +-- llm.writeSection() x N
  +-- llm.writeFrame("intro")
  +-- llm.writeFrame("conclusion")
  +-- llm.editDocument()
  +-- repository.saveMergedDraft()
  +-- llm.reviewDocument()
  +-- repository.saveReview()
  |
  +-- weakSections 있음?
  |     |
  |     +-- yes -> llm.patchSection() x M
  |     |          -> llm.editDocument()
  |     |          -> llm.reviewDocument()
  |     |
  |     +-- no  -> continue
  |
  +-- markdownStore.write()
  +-- repository.completeDocument()
  |
  v
최종 Markdown + SQLite 실행 이력
```

```text
1. 요청 정규화
2. 실행 레코드 생성(SQLite)
3. planner 호출 -> DocumentPlan 저장
4. scheduler로 batch 계산
5. 각 batch의 섹션 초안 작성
6. 서론/결론 작성
7. editor로 전체 Markdown 통합
8. reviewer로 품질 점검
9. weakSections가 있으면 해당 섹션만 patch
10. 최종 Markdown 파일 저장
11. 완료 상태와 결과 저장(SQLite)
```

핵심 포인트:

| 포인트 | 설명 |
|---|---|
| 병렬 실행 | `scheduler.ts`가 dependency DAG를 보고 동시에 써도 되는 섹션 묶음을 계산 |
| 리뷰 보정 | 리뷰 결과가 `passed=true`여도 `weakSections`, `missingSections`, `lengthViolations`, high severity 이슈가 있으면 실패로 보정 |
| 부분 보강 | 전체 문서를 처음부터 다시 쓰지 않고 약한 섹션만 재생성 |
| 저장 분리 | Markdown 파일은 사용자 결과물, SQLite는 실행 추적 저장소 역할 |

### patch 흐름 상세

`DocumentAgent.patchDocument()`는 생성보다 단순합니다.

```text
기존 Markdown 읽기
   |
   v
대상 섹션 추출
   |
   v
LLM에 해당 섹션만 재작성 요청
   |
   v
원본 문서에서 섹션 치환
   |
   v
파일 저장 + 실행 이력 저장
```

이 흐름은 기존 문서 전체를 재생성하지 않고 특정 헤딩 섹션만 교체하고 싶을 때 적합합니다.

## 주요 구현 포인트

### 1. LLM 추상화

`LlmClient` 포트를 기준으로 planner, section writer, editor, reviewer, patcher 기능을 모두 인터페이스화했습니다.

이 덕분에 상위 계층은 공급자가 OpenAI인지, xAI인지, Anthropic인지 직접 알 필요가 없습니다.

### 2. OpenAI 호환 공급자 재사용

`OpenAiCompatibleLlmClientBase`가 OpenAI Responses API 패턴을 공통화하고, `OpenAiLlmClient`와 `XAiLlmClient`는 설정만 다르게 주입합니다.

```text
OpenAiCompatibleLlmClientBase
   ├─ OpenAiLlmClient
   └─ XAiLlmClient
```

반면 Anthropic은 응답 형식과 SDK가 달라 별도 구현체를 둡니다.

### 3. 프롬프트 생성 분리

`document-prompt-factory.ts`가 planner, section writer, editor, reviewer, patch prompt를 각각 생성합니다.

이 구조 덕분에:

| 장점 | 설명 |
|---|---|
| 테스트 용이성 | 프롬프트 문자열 단위로 검증 가능 |
| 공급자 독립성 | 프롬프트 정책과 API 호출 코드를 분리 |
| 유지보수성 | 문서 품질 정책을 한 파일에서 관리 가능 |

## 테스트

기본 테스트 실행:

```bash
bun test
```

현재 테스트는 주로 아래를 검증합니다.

| 범위 | 검증 내용 |
|---|---|
| CLI 파서 | 생성/patch 명령 파싱 |
| 스케줄러 | dependency 기반 batch 계산 |
| LLM 팩토리 | 공급자 선택과 기본 생성 |
| 프롬프트 팩토리 | 프롬프트에 핵심 요구사항 포함 여부 |
| 리뷰 정규화 | 약한 섹션이 있으면 `passed` 보정 |
| Markdown patch | 특정 섹션만 정확히 치환 |
| 오케스트레이션 | 리뷰 후 patch 재시도와 SQLite 저장 |

## 문서 검증 체크리스트

README를 수정하거나 기능을 추가할 때는 아래 항목을 같이 확인하는 것을 권장합니다.

| 체크 항목 | 확인 방법 |
|---|---|
| CLI 옵션 문서가 실제 파서와 일치하는가 | `src/application/services/cli-parser.ts` 확인 |
| 아키텍처 설명이 실제 계층 구조와 맞는가 | `src/application`, `src/domain`, `src/infrastructure` 확인 |
| 저장 구조 설명이 실제 DB 스키마와 맞는가 | `sqlite-document-run-repository.ts` 확인 |
| 생성/patch 흐름 설명이 실제 메서드 순서와 맞는가 | `document-agent.ts` 확인 |
