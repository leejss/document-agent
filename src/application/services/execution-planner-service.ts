import type {
  ExecutionGroup,
  SectionBrief,
} from "../../domain/types/planner.ts";

export function buildExecutionGroups(
  sections: SectionBrief[],
): ExecutionGroup[] {
  const ready = sections.filter(
    (s) => s.dependencies.length === 0 && s.parallelizable,
  );

  const blocked = sections.filter(
    (s) => s.dependencies.length > 0 && !s.parallelizable,
  );

  const groups: ExecutionGroup[] = [];

  if (ready.length > 0) {
    groups.push({
      id: "group-ready",
      sectionIds: ready.map((s) => s.id),
      mode: "parallel",
      reason: "의존성 없는 병렬 실행",
    });
  }

  for (const section of blocked) {
    groups.push({
      id: "group-" + section.id,
      sectionIds: [section.id],
      mode: "sequential",
      reason: `의존성 존재 (${section.dependencies.join(", ")})`,
    });
  }

  return groups;
}
