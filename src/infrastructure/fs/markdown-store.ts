import { FilePersistenceError, InputError } from "../../domain/errors.ts";
import type { HeadingSection } from "../../domain/document.ts";

export class MarkdownStore {
  async read(path: string): Promise<string> {
    try {
      return await Bun.file(path).text();
    } catch (error) {
      throw new FilePersistenceError(`문서를 읽지 못했습니다: ${path}`, error);
    }
  }

  async write(path: string, markdown: string): Promise<void> {
    try {
      const directory = path.split("/").slice(0, -1).join("/");
      if (directory) {
        await Bun.$`mkdir -p ${directory}`.quiet();
      }
      await Bun.write(path, markdown);
    } catch (error) {
      throw new FilePersistenceError(`문서를 저장하지 못했습니다: ${path}`, error);
    }
  }

  extractSection(markdown: string, sectionTitle: string): HeadingSection {
    const sections = parseSections(markdown);
    const match = sections.find((section) => section.title === sectionTitle);
    if (!match) {
      throw new InputError(`문서에서 섹션을 찾지 못했습니다: ${sectionTitle}`);
    }
    return match;
  }

  replaceSection(markdown: string, sectionTitle: string, replacementMarkdown: string): string {
    const section = this.extractSection(markdown, sectionTitle);
    return (
      `${markdown.slice(0, section.start)}${replacementMarkdown.trim()}\n\n${markdown
        .slice(section.end)
        .replace(/^\s+/, "")}`.trimEnd() + "\n"
    );
  }
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
