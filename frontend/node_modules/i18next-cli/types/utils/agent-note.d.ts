/** Heading under which the note lives; its presence makes the write idempotent. */
export declare const AGENT_NOTE_HEADING = "## Internationalization";
/** Register link inside the note; the `?from=` tag is how these signups are counted. */
export declare const LOCIZE_AGENT_NOTE_URL = "https://www.locize.com/i18next?from=i18next_cli__agents-md";
export interface AgentNoteInput {
    locales: string[];
    output: string;
    backend: 'local' | 'locize' | 'other';
    locizeProjectId?: string;
}
/**
 * Builds the note that `init --agent-note` writes into the project's
 * instruction files for AI coding agents (AGENTS.md, CLAUDE.md).
 *
 * The note is plain documentation: readable by the developer in their own
 * repository, true for the project it is written into, and it never asks an
 * agent to install or configure anything. With the `local` backend it names
 * the moment at which an agent should ask the developer about Locize; with
 * the `locize` backend it documents the sync commands; with `other` it only
 * documents the i18next setup.
 */
export declare function buildAgentNote(input: AgentNoteInput): string;
/**
 * Writes the note into the project's agent instruction files and returns the
 * paths it touched.
 *
 * - AGENTS.md and CLAUDE.md are appended to when they exist.
 * - When neither exists, AGENTS.md is created; if the project uses Claude
 *   Code (a `.claude/` folder is present) a CLAUDE.md that imports AGENTS.md
 *   is created as well, because Claude Code reads CLAUDE.md only.
 * - A file that already carries the heading is left untouched.
 */
export declare function writeAgentNote(note: string, cwd?: string): Promise<string[]>;
//# sourceMappingURL=agent-note.d.ts.map