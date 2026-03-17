# document-agent

`document-agent`는 Planner-Executor 패턴으로 긴 문서를 생성하는 Bun 기반 CLI를 목표로 하는 프로젝트입니다.

## 목표 사용 방식

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

## 현재 상태

현재 저장소는 CLI 완성본이 아니라, 문서 생성 워크플로우를 구성하는 서비스와 타입을 먼저 정의한 스켈레톤에 가깝습니다.

```text
CLI (목표)
  -> request analyzer
  -> planner
  -> section writer
  -> editor
  -> reviewer
  -> patch
```

루트 엔트리와 공개 export는 아래 파일에 모여 있습니다.

- [index.ts](/Users/tinyyard/project/document-agent/index.ts)
- [src/index.ts](/Users/tinyyard/project/document-agent/src/index.ts)

## 개발 시작

의존성 설치:

```bash
bun install
```

현재 엔트리 확인:

```bash
bun run index.ts
```

CLI 요구사항과 사용자 인터페이스 초안은 [PRD.md](/Users/tinyyard/project/document-agent/PRD.md)에 정리되어 있습니다.
