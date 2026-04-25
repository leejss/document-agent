export type SectionStatus =
  | "todo"
  | "ready"
  | "writing"
  | "written"
  | "editing"
  | "done"
  | "failed";

export interface GlobalBrief {
  topic: string;
  audience: string;
  purpose: string;
  glossary: string[];
  styleGuide: string[];
  lengthPolicy: string;
  duplicationRules: string[];
}

export interface SectionPlan {
  id: string;
  title: string;
  goal: string;
  keyPoints: string[];
  minWords: number;
  dependsOn: string[];
  parallelizable: boolean;
  avoidOverlapWith: string[];
  status: SectionStatus;
}

export interface DocumentPlan {
  title: string;
  globalBrief: GlobalBrief;
  outline: string[];
  sections: SectionPlan[];
  introBrief: string;
  conclusionBrief: string;
}
