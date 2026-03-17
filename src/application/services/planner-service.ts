import { z } from "zod";
import type { LlmClient } from "../ports/llm-client.ts";
import type { Logger } from "../ports/logger.ts";
import type {
  PlannerResult,
  SectionBrief,
} from "../../domain/types/planner.ts";
import type { NormalizedDocumentRequest } from "../../domain/types/request.ts";
import {
  DEFAULT_OUTLINE_SECTION_MAX,
  DEFAULT_OUTLINE_SECTION_MIN,
} from "../../domain/constants/quality-rules.ts";
import { PLANNER_SYSTEM_PROMPT } from "../../agents/prompts/planner.ts";
import { buildExecutionGroups } from "./execution-planner-service.ts";

const PlannerStructuredOutputSchema = z.object({
  title: z.string(),
  summary: z.string(),
  glossary: z.array(z.string()),
  styleGuide: z.object({
    tone: z.enum([
      "formal",
      "neutral",
      "friendly",
      "persuasive",
      "instructional",
    ]),
    audienceLevel: z.enum(["beginner", "intermediate", "advanced", "mixed"]),
    terminologyRules: z.array(z.string()),
    forbiddenPatterns: z.array(z.string()),
    lengthPolicy: z.object({
      targetLength: z.enum(["short", "medium", "long"]),
      minSections: z.number(),
      maxSections: z.number(),
    }),
  }),
  avoidOverlapRules: z.array(z.string()),
  plannerNotes: z.array(z.string()),
  sections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      kind: z.enum(["introduction", "body", "conclusion", "appendix", "faq"]),
      purpose: z.string(),
      keyPoints: z.array(z.string()),
      requiredElements: z.array(
        z.enum(["explanation", "example", "comparison", "code", "checklist"]),
      ),
      minWordCount: z.number(),
      dependencies: z.array(z.string()),
      avoidOverlapWith: z.array(z.string()),
      parallelizable: z.boolean(),
    }),
  ),
});

type PlannerStructuredOutput = z.infer<typeof PlannerStructuredOutputSchema>;

export async function createPlan(
  request: NormalizedDocumentRequest,
  deps: {
    llm: LlmClient;
    logger: Logger;
  },
): Promise<PlannerResult> {
  deps.logger.info("Creating document plan for topic: " + request.topic);

  const structured = await deps.llm.generateStructured<PlannerStructuredOutput>(
    {
      schemaName: "planner-result",
      schema: PlannerStructuredOutputSchema,
      systemPrompt: PLANNER_SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        request,
        rules: {
          minSections: DEFAULT_OUTLINE_SECTION_MIN,
          maxSections: DEFAULT_OUTLINE_SECTION_MAX,
        },
      }),
    },
  );

  return {
    globalBrief: {
      topic: request.topic,
      purpose: request.purpose,
      targetAudience: request.audience,
      documentFormat: request.format,
      title: structured.title,
      summary: structured.summary,
      glossary: structured.glossary,
      styleGuide: structured.styleGuide,
      avoidOverlapRules: structured.avoidOverlapRules,
      constraints: request.constraints,
      mustInclude: request.requiredSections,
    },
    outline: {
      title: structured.title,
      sections: structured.sections as SectionBrief[],
    },
    executionGroups: buildExecutionGroups(structured.sections),
    plannerNotes: structured.plannerNotes,
  };
}
