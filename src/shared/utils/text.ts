export function countWords(text: string): number {
  const normalized = text.trim()
  if (!normalized) return 0

  // Split by any whitespace and filter out empty strings
  return normalized.split(/\s+/).length;
}
