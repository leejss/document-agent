import { Effect, Layer } from "effect";
import { Store } from "./store.ts";
import type { HeadingSection } from "../document/section.ts";
import { FilePersistenceError, InputError } from "../error/error.ts";

export const layer = Layer.effect(
	Store,
	Effect.sync(() => {
		const read = (path: string): Effect.Effect<string, FilePersistenceError> =>
			Effect.tryPromise({
				try: () => Bun.file(path).text(),
				catch: (error) =>
					new FilePersistenceError(`문서를 읽지 못했습니다: ${path}`, error),
			});

		const write = (
			path: string,
			markdown: string,
		): Effect.Effect<void, FilePersistenceError> =>
			Effect.tryPromise({
				try: async () => {
					const directory = path.split("/").slice(0, -1).join("/");
					if (directory) {
						await Bun.$`mkdir -p ${directory}`.quiet();
					}
					await Bun.write(path, markdown);
				},
				catch: (error) =>
					new FilePersistenceError(
						`문서를 저장하지 못했습니다: ${path}`,
						error,
					),
			});

		const extractSection = (
			markdown: string,
			sectionTitle: string,
		): Effect.Effect<HeadingSection, InputError> =>
			Effect.sync(() => {
				const sections = parseSections(markdown);
				const match = sections.find(
					(section) => section.title === sectionTitle,
				);
				if (!match) {
					throw new InputError(
						`문서에서 섹션을 찾지 못했습니다: ${sectionTitle}`,
					);
				}
				return match;
			});

		const replaceSection = (
			markdown: string,
			sectionTitle: string,
			replacementMarkdown: string,
		): Effect.Effect<string, InputError> =>
			Effect.sync(() => {
				const section = extractSectionSync(markdown, sectionTitle);
				return (
					`${markdown.slice(0, section.start)}${replacementMarkdown.trim()}\n\n${markdown
						.slice(section.end)
						.replace(/^\s+/, "")}`.trimEnd() + "\n"
				);
			});

		return {
			read,
			write,
			extractSection,
			replaceSection,
		};
	}),
);

function extractSectionSync(
	markdown: string,
	sectionTitle: string,
): HeadingSection {
	const sections = parseSections(markdown);
	const match = sections.find((section) => section.title === sectionTitle);
	if (!match) {
		throw new InputError(`문서에서 섹션을 찾지 못했습니다: ${sectionTitle}`);
	}
	return match;
}

function parseSections(markdown: string): HeadingSection[] {
	const headingRegex = /^(#{1,6})\s+(.+?)\s*$/gm;
	const matches = [...markdown.matchAll(headingRegex)];
	return matches.map((match, index) => {
		const start = match.index ?? 0;
		const headingLine = match[0];
		const hashes = match[1];
		const rawTitle = match[2];
		if (!hashes || !rawTitle) {
			throw new InputError("Markdown heading을 해석하지 못했습니다.");
		}
		const level = hashes.length;
		const title = rawTitle.trim();
		const contentStart = start + headingLine.length + 1;
		const next = matches[index + 1];
		const end = next?.index ?? markdown.length;
		return {
			title,
			level,
			start,
			end,
			contentStart,
			contentEnd: end,
			headingLine,
			body: markdown.slice(contentStart, end).trim(),
		};
	});
}
