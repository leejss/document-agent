export type DocumentLength = "short" | "medium" | "long";

export type DocumentFormat =
  | "technical-design"
  | "prd"
  | "guide"
  | "proposal"
  | "generic";

export type Tone =
  | "formal"
  | "neutral"
  | "friendly"
  | "persuasive"
  | "instructional";

export interface CreateDocumentRequest {
  topic: string;
  purpose?: string;
  audience?: string;
  format?: DocumentFormat;
  tone?: Tone;
  targetLength?: DocumentLength;
  requiredSections?: string[];
  constraints?: string[];
}

export interface NormalizedDocumentRequest {
  topic: string;
  purpose: string;
  audience: string;
  format: DocumentFormat;
  tone: Tone;
  targetLength: DocumentLength;
  requiredSections: string[];
  constraints: string[];
}
