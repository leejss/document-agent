# document-agent

`document-agent`는 Planner-Executor 패턴으로 긴 문서를 생성하는 Bun 기반 CLI를 목표로 하는 프로젝트입니다.

## 사용 방식

```bash
doc-agent "ReAct 패턴과 관련된 기술문서 작성해줘"
```

확장 예시:

```bash
doc-agent "ReAct 패턴과 관련된 기술문서 작성해줘" \
  --format guide \
  --audience "백엔드 엔지니어" \
  --length long \
  --output ./out/react-guide.md
```

특정 섹션만 보강:

```bash
doc-agent patch ./out/react-guide.md --section "병렬 실행 전략"
```

## 저장 구조

최종 산출물은 Markdown 파일로 저장하고, 실행 상태와 중간 산출물은 Bun 내장 SQLite에 저장합니다.

| 저장 대상 | 매체 | 설명 |
|---|---|---|
| 최종 문서 | Markdown 파일 | `--output` 경로 또는 patch 대상 파일 |
| 요청/플랜/리뷰 | SQLite | 문서별 실행 이력과 reviewer 결과 |
| 섹션 초안 | SQLite | section 단위 draft 및 patch 재시도 이력 |
| 로그 | SQLite | 단계별 진행 로그 |

```text
CLI
  -> OpenAI planner/executor/editor/reviewer
  -> Markdown output
  -> SQLite state store
```

기본 SQLite 경로:

```text
.document-agent/document-agent.sqlite
```

## 환경 변수

| 이름 | 설명 |
|---|---|
| `OPENAI_API_KEY` | 필수. OpenAI API 키 |
| `OPENAI_MODEL` | 선택. 기본값은 `gpt-5.2` |

## 현재 상태

현재 저장소는 문서 생성과 patch가 가능한 MVP CLI를 포함합니다.

```text
CLI
  -> request analyzer
  -> planner
  -> section writer
  -> editor
  -> reviewer
  -> patch
```

## 개발 시작

의존성 설치:

```bash
bun install
```

테스트:

```bash
bun test
```

실행:

```bash
bun run src/index.ts "planner-executor 설계 문서 작성해줘" --stdout
```

CLI 요구사항과 사용자 인터페이스 초안은 [PRD.md](/Users/tinyyard/project/document-agent/PRD.md)에 정리되어 있습니다.
