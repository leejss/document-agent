import type { ParallelMode, SectionPlan } from "../../domain/document.ts";
import { WorkflowError } from "../../domain/errors.ts";

export function buildExecutionBatches(
  sections: SectionPlan[],
  parallelMode: ParallelMode,
): SectionPlan[][] {
  if (parallelMode === "off") {
    return sections.map((section) => [section]);
  }

  const remaining = new Set(sections.map((section) => section.id));
  const batches: SectionPlan[][] = [];

  while (remaining.size > 0) {
    const ready = sections.filter(
      (section) =>
        remaining.has(section.id) &&
        section.dependsOn.every((dependencyId) => !remaining.has(dependencyId)),
    );

    if (ready.length === 0) {
      throw new WorkflowError("섹션 dependency DAG를 계산할 수 없습니다.");
    }

    const firstReady = ready[0];
    if (!firstReady) {
      throw new WorkflowError("ready 섹션을 계산하지 못했습니다.");
    }
    const batch = firstReady.parallelizable ? ready.filter((section) => section.parallelizable) : [firstReady];
    batches.push(batch);

    for (const section of batch) {
      remaining.delete(section.id);
    }
  }

  return batches;
}
