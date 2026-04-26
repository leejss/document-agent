import { Context, Effect } from "effect";
import type { HeadingSection } from "../document/section.ts";
import type { FilePersistenceError, InputError } from "../error/error.ts";

export interface Interface {
	readonly read: (path: string) => Effect.Effect<string, FilePersistenceError>;
	readonly write: (
		path: string,
		markdown: string,
	) => Effect.Effect<void, FilePersistenceError>;
	readonly extractSection: (
		markdown: string,
		sectionTitle: string,
	) => Effect.Effect<HeadingSection, InputError>;
	readonly replaceSection: (
		markdown: string,
		sectionTitle: string,
		replacementMarkdown: string,
	) => Effect.Effect<string, InputError>;
}

export class Store extends Context.Tag("MarkdownStore")<Store, Interface>() {}
