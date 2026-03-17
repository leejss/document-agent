import type { Logger } from "../../application/ports/logger.ts";

/**
 * 학습용 기본 로거.
 * 구현 단계에서는 로그 포맷과 메타데이터 정책을 먼저 정하는 편이 좋다.
 */
export const consoleLogger: Logger = {
  info(_message, _metadata) {
    throw new Error("TODO: consoleLogger.info 구현");
  },
  warn(_message, _metadata) {
    throw new Error("TODO: consoleLogger.warn 구현");
  },
  error(_message, _metadata) {
    throw new Error("TODO: consoleLogger.error 구현");
  },
};
