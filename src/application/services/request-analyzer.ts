import type {
  CreateDocumentRequest,
  NormalizedDocumentRequest,
} from "../../domain/types/request.ts";

export async function analyzeRequest(
  request: CreateDocumentRequest,
): Promise<NormalizedDocumentRequest> {
  const topic = request.topic.trim();

  if (!topic) {
    throw new Error("Topic is required.");
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

  }
}
