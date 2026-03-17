import { afterEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseArgv } from "./application/services/cli-parser.ts";
import { DocumentAgentService } from "./application/services/document-agent.ts";
import { buildExecutionBatches } from "./application/services/scheduler.ts";
import type { LlmClient } from "./application/ports/llm-client.ts";
import type { Logger } from "./application/ports/logger.ts";
import type {
  DocumentPlan,
  DocumentRequest,
  ReviewReport,
  SectionDraft,
} from "./domain/document.ts";
import { MarkdownStore } from "./infrastructure/fs/markdown-store.ts";
import { SqliteDocumentRunRepository } from "./infrastructure/persistence/sqlite-document-run-repository.ts";

const tempPaths: string[] = [];

afterEach(() => {
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

describe("cli parser", () => {
  test("기본 생성 명령과 repeatable 옵션을 파싱한다", () => {
    const command = parseArgv([
      "planner-executor 문서 작성해줘",
      "--format",
      "guide",
      "--required-section",
      "문제 정의",
      "--required-section",
      "아키텍처",
      "--constraint",
      "코드 예시 포함",
      "--stdout",
    ]);

    expect(command.kind).toBe("generate");
    if (command.kind === "generate") {
      expect(command.request.prompt).toBe("planner-executor 문서 작성해줘");
      expect(command.request.format).toBe("guide");
      expect(command.request.requiredSections).toEqual(["문제 정의", "아키텍처"]);
      expect(command.request.constraints).toEqual(["코드 예시 포함"]);
      expect(command.request.stdout).toBe(true);
    }
  });

  test("patch 명령을 파싱한다", () => {
    const command = parseArgv(["patch", "./out/doc.md", "--section", "병렬 실행 전략", "--output", "./out/patched.md"]);
    expect(command.kind).toBe("patch");
    if (command.kind === "patch") {
      expect(command.path).toBe("./out/doc.md");
      expect(command.sectionTitle).toBe("병렬 실행 전략");
      expect(command.request.outputPath).toBe("./out/patched.md");
    }
  });
});

describe("scheduler", () => {
  test("dependency 기준으로 병렬 batch를 계산한다", () => {
    const batches = buildExecutionBatches(
      [
        makeSectionPlan("intro", [], false),
        makeSectionPlan("problem", ["intro"], true),
        makeSectionPlan("architecture", ["intro"], true),
        makeSectionPlan("review", ["problem", "architecture"], false),
      ],
      "auto",
    );

    expect(batches.map((batch) => batch.map((section) => section.id))).toEqual([
      ["intro"],
      ["problem", "architecture"],
      ["review"],
    ]);
  });
});

describe("markdown patcher", () => {
  test("지정한 섹션만 치환한다", () => {
    const store = new MarkdownStore();
    const markdown = [
      "# 제목",
      "",
      "## 서론",
      "도입부",
      "",
      "## 병렬 실행 전략",
      "기존 내용",
      "",
      "## 결론",
      "끝",
      "",
    ].join("\n");

    const next = store.replaceSection(
      markdown,
      "병렬 실행 전략",
      ["## 병렬 실행 전략", "새로운 내용", "", "- bullet"].join("\n"),
    );

    expect(next).toContain("새로운 내용");
    expect(next).toContain("## 결론");
    expect(next).not.toContain("기존 내용");
  });
});

describe("orchestration and sqlite persistence", () => {
  test("reviewer가 약한 섹션을 반환하면 patch를 1회 수행하고 sqlite에 저장한다", async () => {
    const directory = makeTempDir();
    const outputPath = join(directory, "out", "doc.md");
    const repository = new SqliteDocumentRunRepository(join(directory, "runs.sqlite"));
    repository.initialize();
    const logger = new MemoryLogger();
    const llm = new FakeLlmClient();
    const service = new DocumentAgentService(llm, repository, logger, new MarkdownStore());

    const result = await service.generate({
      prompt: "planner-executor 설계 문서 작성",
      format: "technical-design",
      audience: "백엔드 엔지니어",
      purpose: "설계 공유",
      tone: "formal",
      length: "medium",
      requiredSections: [],
      constraints: [],
      outputPath,
      stdout: false,
      verbose: true,
      parallel: "auto",
    });

    expect(result.review.passed).toBe(true);
    expect(llm.patchCalls).toBe(1);
    const saved = repository.getDocumentRun(result.documentId);
    expect(saved?.status).toBe("completed");
    expect(saved?.finalMarkdown).toContain("# Planner Executor 설계 문서");
  });
});

function makeSectionPlan(id: string, dependsOn: string[], parallelizable: boolean) {
  return {
    id,
    title: id,
    goal: `${id} 설명`,
    keyPoints: ["a", "b"],
    minWords: 200,
    dependsOn,
    parallelizable,
    avoidOverlapWith: [],
    status: "todo" as const,
  };
}

function makeTempDir() {
  const directory = join(tmpdir(), `document-agent-${crypto.randomUUID()}`);
  tempPaths.push(directory);
  return directory;
}

class MemoryLogger implements Logger {
  logs: string[] = [];

  log(_: "info" | "debug" | "warn" | "error", message: string): void {
    this.logs.push(message);
  }
}

class FakeLlmClient implements LlmClient {
  reviewCalls = 0;
  patchCalls = 0;

  async planDocument(request: DocumentRequest): Promise<DocumentPlan> {
    return {
      title: "Planner Executor 설계 문서",
      globalBrief: {
        topic: request.prompt,
        audience: request.audience ?? "엔지니어",
        purpose: request.purpose ?? "설계 설명",
        glossary: ["planner", "executor"],
        styleGuide: ["용어 일관성 유지"],
        lengthPolicy: "각 섹션 200단어 이상",
        duplicationRules: ["같은 예시를 반복하지 않는다"],
      },
      outline: ["문제 정의", "요구사항", "아키텍처", "병렬 실행 전략", "검증 전략"],
      sections: [
        makeSectionPlan("problem", [], true),
        makeSectionPlan("requirements", [], true),
        makeSectionPlan("architecture", ["problem"], true),
        makeSectionPlan("parallel", ["architecture"], true),
        makeSectionPlan("validation", ["parallel"], false),
      ].map((section, index) => {
        const titles = ["문제 정의", "요구사항", "아키텍처", "병렬 실행 전략", "검증 전략"] as const;
        return {
          ...section,
          title: titles[index] ?? section.title,
        };
      }),
      introBrief: "서론을 작성한다.",
      conclusionBrief: "결론을 작성한다.",
    };
  }

  async writeSection(input: Parameters<LlmClient["writeSection"]>[0]): Promise<SectionDraft> {
    return {
      sectionId: input.section.id,
      title: input.section.title,
      markdown: `## ${input.section.title}\n${"설명 ".repeat(120)}`,
      status: "written",
      wordCount: 120,
    };
  }

  async writeFrame(input: Parameters<LlmClient["writeFrame"]>[0]): Promise<SectionDraft> {
    return {
      sectionId: input.kind,
      title: input.kind === "intro" ? "서론" : "결론",
      markdown: `## ${input.kind === "intro" ? "서론" : "결론"}\n${"정리 ".repeat(60)}`,
      status: "written",
      wordCount: 60,
    };
  }

  async editDocument(input: Parameters<LlmClient["editDocument"]>[0]): Promise<string> {
    return [
      `# ${input.plan.title}`,
      "",
      input.intro.markdown,
      ...input.sections.map((section) => section.markdown),
      input.conclusion.markdown,
    ].join("\n\n");
  }

  async reviewDocument(_: Parameters<LlmClient["reviewDocument"]>[0]): Promise<ReviewReport> {
    this.reviewCalls += 1;
    if (this.reviewCalls === 1) {
      return {
        passed: false,
        issues: [
          {
            sectionTitle: "병렬 실행 전략",
            severity: "medium",
            message: "예시가 부족합니다.",
            recommendation: "실행 배치 예시를 추가하세요.",
          },
        ],
        weakSections: ["병렬 실행 전략"],
        missingSections: [],
        lengthViolations: [],
        summary: "병렬 실행 전략 보강 필요",
      };
    }

    return {
      passed: true,
      issues: [],
      weakSections: [],
      missingSections: [],
      lengthViolations: [],
      summary: "통과",
    };
  }

  async patchSection(input: Parameters<LlmClient["patchSection"]>[0]): Promise<SectionDraft> {
    this.patchCalls += 1;
    return {
      sectionId: input.targetSection.id,
      title: input.targetSection.title,
      markdown: `## ${input.targetSection.title}\n${"보강 ".repeat(160)}`,
      status: "written",
      wordCount: 160,
    };
  }

  async patchExistingSection(input: Parameters<LlmClient["patchExistingSection"]>[0]): Promise<string> {
    return `## ${input.sectionTitle}\n${"패치 ".repeat(80)}`;
  }
}
