export type DocumentFormat =
	| "guide"
	| "prd"
	| "technical-design"
	| "proposal"
	| string;
export type Tone = "formal" | "neutral" | "friendly" | string;
export type LengthLevel = "short" | "medium" | "long";
export type ParallelMode = "auto" | "off";
export type LogLevel = "info" | "debug" | "warn" | "error";

export interface DocumentRequest {
	prompt: string;
	format?: DocumentFormat;
	audience?: string;
	purpose?: string;
	tone?: Tone;
	length?: LengthLevel;
	requiredSections: string[];
	constraints: string[];
	outputPath?: string;
	stdout: boolean;
	verbose: boolean;
	parallel: ParallelMode;
}

export function defaultLength(level?: LengthLevel): LengthLevel {
	return level ?? "medium";
}

export function defaultParallelMode(mode?: ParallelMode): ParallelMode {
	return mode ?? "auto";
}

export function buildLengthPolicy(length: LengthLevel): string {
	switch (length) {
		case "short":
			return "각 섹션은 핵심 설명 중심으로 최소 180단어 이상 작성한다.";
		case "long":
			return "각 섹션은 예시와 비교를 포함해 최소 420단어 이상 작성한다.";
		default:
			return "각 섹션은 설명과 예시를 포함해 최소 280단어 이상 작성한다.";
	}
}

export function estimateSectionMinWords(length: LengthLevel): number {
	switch (length) {
		case "short":
			return 180;
		case "long":
			return 420;
		default:
			return 280;
	}
}

export function normalizeRequest(request: DocumentRequest): DocumentRequest {
	const length = defaultLength(request.length);
	return {
		...request,
		format: request.format ?? "technical-design",
		audience: request.audience ?? "기술 문서를 읽는 엔지니어",
		purpose:
			request.purpose ??
			"주제를 설명하고 실제 구현 판단에 필요한 근거를 제공한다.",
		tone: request.tone ?? "formal",
		length,
		requiredSections: request.requiredSections,
		constraints: request.constraints,
		parallel: defaultParallelMode(request.parallel),
	};
}
