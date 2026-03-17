export interface LlmTextGenerationParams {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmStructuredGenerationParams<TSchemaName extends string> {
  schemaName: TSchemaName;
  systemPrompt: string;
  userPrompt: string;
}

export interface LlmClient {
  generateText(params: LlmTextGenerationParams): Promise<string>;
  generateStructured<T>(
    params: LlmStructuredGenerationParams<string>,
  ): Promise<T>;
}
