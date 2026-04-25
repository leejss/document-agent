export interface ReviewIssue {
  sectionTitle: string | null;
  severity: "low" | "medium" | "high";
  message: string;
  recommendation: string;
}

export interface ReviewReport {
  passed: boolean;
  issues: ReviewIssue[];
  weakSections: string[];
  missingSections: string[];
  lengthViolations: string[];
  summary: string;
}

export function normalizeReviewReport(review: ReviewReport): ReviewReport {
  const hasBlockingSignals =
    review.weakSections.length > 0 ||
    review.missingSections.length > 0 ||
    review.lengthViolations.length > 0 ||
    review.issues.some((issue) => issue.severity === "high");

  return {
    ...review,
    passed: hasBlockingSignals ? false : review.passed,
  };
}
