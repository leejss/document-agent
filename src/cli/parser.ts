import type { DocumentRequest, ParallelMode } from "../document/request.ts";
import { InputError } from "../error/error.ts";

export interface GenerateCommand {
  kind: "generate";
  request: DocumentRequest;
}

export interface PatchCommand {
  kind: "patch";
  path: string;
  sectionTitle: string;
  request: Partial<DocumentRequest> & { verbose: boolean; stdout: boolean; outputPath?: string };
}

export type CliCommand = GenerateCommand | PatchCommand;

const repeatableOptions = new Set(["required-section", "constraint"]);
const stringOptions = new Set([
  "format",
  "audience",
  "purpose",
  "tone",
  "length",
  "output",
  "parallel",
  "section",
]);
const booleanOptions = new Set(["stdout", "verbose"]);

export function parseArgv(argv: string[]): CliCommand {
  if (argv.length === 0) {
    throw new InputError('요청 문자열 또는 "patch" 명령이 필요합니다.');
  }

  if (argv[0] === "patch") {
    return parsePatchCommand(argv.slice(1));
  }

  const prompt = argv[0];
  if (!prompt) {
    throw new InputError("요청 문자열이 필요합니다.");
  }
  const parsed = parseOptions(argv.slice(1));
  return {
    kind: "generate",
    request: {
      prompt,
      format: parsed.scalar.format,
      audience: parsed.scalar.audience,
      purpose: parsed.scalar.purpose,
      tone: parsed.scalar.tone,
      length: parsed.scalar.length as DocumentRequest["length"],
      outputPath: parsed.scalar.output,
      stdout: parsed.flags.stdout ?? false,
      verbose: parsed.flags.verbose ?? false,
      parallel: (parsed.scalar.parallel as ParallelMode | undefined) ?? "auto",
      requiredSections: parsed.repeatable["required-section"] ?? [],
      constraints: parsed.repeatable.constraint ?? [],
    },
  };
}

function parsePatchCommand(argv: string[]): PatchCommand {
  const path = argv[0];
  if (!path) {
    throw new InputError("patch 명령에는 문서 경로가 필요합니다.");
  }

  const parsed = parseOptions(argv.slice(1));
  const sectionTitle = parsed.scalar.section;
  if (!sectionTitle) {
    throw new InputError('patch 명령에는 `--section "<섹션명>"` 이 필요합니다.');
  }

  return {
    kind: "patch",
    path,
    sectionTitle,
    request: {
      format: parsed.scalar.format,
      audience: parsed.scalar.audience,
      purpose: parsed.scalar.purpose,
      tone: parsed.scalar.tone,
      length: parsed.scalar.length as DocumentRequest["length"],
      outputPath: parsed.scalar.output,
      stdout: parsed.flags.stdout ?? false,
      verbose: parsed.flags.verbose ?? false,
      parallel: (parsed.scalar.parallel as ParallelMode | undefined) ?? "off",
      requiredSections: parsed.repeatable["required-section"] ?? [],
      constraints: parsed.repeatable.constraint ?? [],
    },
  };
}

function parseOptions(argv: string[]) {
  const scalar: Record<string, string> = {};
  const repeatable: Record<string, string[]> = {};
  const flags: Record<string, boolean> = { stdout: false, verbose: false };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) {
      throw new InputError("빈 인자를 해석할 수 없습니다.");
    }
    if (!token.startsWith("--")) {
      throw new InputError(`알 수 없는 인자: ${token}`);
    }

    const name = token.slice(2);
    if (booleanOptions.has(name)) {
      flags[name] = true;
      continue;
    }

    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      throw new InputError(`옵션 --${name} 에 값이 필요합니다.`);
    }

    if (repeatableOptions.has(name)) {
      repeatable[name] ??= [];
      repeatable[name].push(nextValue);
      index += 1;
      continue;
    }

    if (stringOptions.has(name)) {
      scalar[name] = nextValue;
      index += 1;
      continue;
    }

    throw new InputError(`지원하지 않는 옵션: --${name}`);
  }

  return { scalar, repeatable, flags };
}
