export class AppError extends Error {
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
  constructor(message: string) {
    super(message, 2);
  }
}

export class WorkflowError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 1, cause);
  }
}

export class ExternalDependencyError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 3, cause);
  }
}

export class FilePersistenceError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 4, cause);
  }
}
