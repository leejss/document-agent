import { z } from "zod";

export const plannerSchema = z.object({
  title: z.string(),
  globalBrief: z.object({
    topic: z.string(),
    audience: z.string(),
    purpose: z.string(),
    glossary: z.array(z.string()).default([]),
    styleGuide: z.array(z.string()).default([]),
    lengthPolicy: z.string(),
    duplicationRules: z.array(z.string()).default([]),
  }),
  outline: z.array(z.string()).min(5).max(9),
  sections: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        goal: z.string(),
        keyPoints: z.array(z.string()).min(2),
        minWords: z.number().int().positive(),
        dependsOn: z.array(z.string()).default([]),
        parallelizable: z.boolean(),
        avoidOverlapWith: z.array(z.string()).default([]),
        status: z
          .enum(["todo", "ready", "writing", "written", "editing", "done", "failed"])
          .default("todo"),
      }),
    )
    .min(5)
    .max(9),
  introBrief: z.string(),
  conclusionBrief: z.string(),
});

export const reviewSchema = z.object({
  passed: z.boolean(),
  issues: z.array(
    z.object({
      sectionTitle: z.string().nullable().default(null),
      severity: z.enum(["low", "medium", "high"]),
      message: z.string(),
      recommendation: z.string(),
    }),
  ),
  weakSections: z.array(z.string()).default([]),
  missingSections: z.array(z.string()).default([]),
  lengthViolations: z.array(z.string()).default([]),
  summary: z.string(),
});
