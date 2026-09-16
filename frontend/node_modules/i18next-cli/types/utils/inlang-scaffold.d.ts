export interface InlangScaffoldOptions {
    /** All project locales (the first one is used as `baseLocale` unless `primaryLanguage` is set). */
    locales: string[];
    /** The base/source locale. Defaults to the first entry of `locales`. */
    primaryLanguage?: string;
    /** The `extract.output` template, e.g. `public/locales/{{language}}/{{namespace}}.json`. */
    output: string | ((language: string, namespace?: string) => string);
    /** Default namespace used as fallback when no resource files exist yet (default: 'translation'). */
    defaultNS?: string | false;
}
/**
 * Scaffolds an inlang project (`project.inlang/settings.json`) next to the
 * i18next configuration so that inlang tooling (Sherlock VS Code extension,
 * Fink editor, Paraglide compiler) operates on the EXISTING i18next JSON
 * files. The i18next files remain the single source of truth — the scaffold
 * is just the adapter.
 *
 * Behavior:
 * - Derives `plugin.inlang.i18next.pathPattern` from the `extract.output`
 *   template: the namespaced object form when the template contains a
 *   `{{namespace}}` placeholder (namespaces are discovered from the files of
 *   the primary language), the plain string form otherwise.
 * - Never overwrites an existing `project.inlang/settings.json`.
 * - Adds the Sherlock extension to `.vscode/extensions.json` recommendations
 *   (creating or comment-preservingly merging the file).
 */
export declare function scaffoldInlangProject(options: InlangScaffoldOptions): Promise<void>;
//# sourceMappingURL=inlang-scaffold.d.ts.map