import type { I18nextToolkitConfig } from '../types.js';
/** Frontend framework classification used by the `localize` orchestrator. */
export type DetectedFramework = 'react' | 'next' | 'vue' | 'svelte' | 'angular' | 'unknown';
export interface DetectedStack {
    /** The detected frontend framework (`next` takes precedence over `react`). */
    framework: DetectedFramework;
    /** Whether i18next (or a framework binding like react-i18next) is a dependency */
    hasI18next: boolean;
    /** Whether TypeScript is in use (tsconfig.json present) */
    hasTypeScript: boolean;
    /** Path of an existing i18n init file (relative to cwd), if any */
    initFile: string | null;
    /** Next.js App Router detected (`app/` or `src/app/` directory) */
    hasAppRouter: boolean;
    /** The app uses inlang Paraglide (`@inlang/paraglide-js` or a `project.inlang/` dir) */
    hasParaglide: boolean;
}
/**
 * Detects the project stack relevant to the `localize` orchestrator:
 * frontend framework, i18next presence, an existing i18n init file,
 * Next.js App Router usage and inlang Paraglide usage.
 *
 * All checks are `process.cwd()`-relative (run from the package directory
 * in monorepos).
 *
 * @param findInitFile - locator for an existing i18n init file
 *                       (injected to reuse the instrumenter's implementation)
 */
export declare function detectStack(findInitFile: () => Promise<string | null>): Promise<DetectedStack>;
/**
 * Checks whether a configured plugin covers the detected stack's file
 * extension via `instrumentExtensions` or `lintExtensions` — in which case
 * the instrument/extract runners can process the stack's files through the
 * plugin hooks and `localize` runs the full flow.
 */
export declare function hasStackPlugin(config: I18nextToolkitConfig, framework: DetectedFramework): boolean;
//# sourceMappingURL=detect.d.ts.map