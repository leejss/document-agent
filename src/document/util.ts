export function wordCount(markdown: string): number {
	return markdown.trim().split(/\s+/).filter(Boolean).length;
}
