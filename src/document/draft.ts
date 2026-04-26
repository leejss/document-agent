import type { SectionStatus } from "./plan.ts";

export interface SectionDraft {
	sectionId: string;
	title: string;
	markdown: string;
	status: Exclude<SectionStatus, "todo" | "ready">;
	wordCount: number;
}
