export class AppError extends Error {
  public readonly _tag: string = "AppError";
  public readonly exitCode: number;
  public override readonly cause?: unknown;

  constructor(message: string, exitCode: number, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.exitCode = exitCode;
    this.cause = cause;
  }
}

export class InputError extends AppError {
  public override readonly _tag = "InputError";

  constructor(message: string) {
    super(message, 2);
  }
}

export class WorkflowError extends AppError {
  public override readonly _tag = "WorkflowError";

  constructor(message: string, cause?: unknown) {
    super(message, 1, cause);
  }
}

export class ExternalDependencyError extends AppError {
  public override readonly _tag = "ExternalDependencyError";

  constructor(message: string, cause?: unknown) {
    super(message, 3, cause);
  }
}

export class FilePersistenceError extends AppError {
  public override readonly _tag = "FilePersistenceError";

  constructor(message: string, cause?: unknown) {
    super(message, 4, cause);
  }
}

export type DocumentAgentError =
  | InputError
  | WorkflowError
  | ExternalDependencyError
  | FilePersistenceError;
