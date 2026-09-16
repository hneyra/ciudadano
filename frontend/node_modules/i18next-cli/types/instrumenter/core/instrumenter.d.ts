import type { Logger, I18nextToolkitConfig, InstrumenterOptions, CandidateString, InstrumentationResults } from '../../types.js';
/**
 * Main orchestrator for the instrument command.
 * Scans source files for hardcoded strings and instruments them with i18next calls.
 *
 * @param config - Toolkit configuration
 * @param options - Instrumentation options (dry-run, interactive, etc.)
 * @param logger - Logger instance
 * @returns Instrumentation results
 */
export declare function runInstrumenter(config: I18nextToolkitConfig, options: InstrumenterOptions, logger?: Logger): Promise<InstrumentationResults>;
/**
 * Checks if the project uses React.
 */
export declare function isProjectUsingReact(): Promise<boolean>;
export type ProjectEnvironment = 'browser' | 'node-server' | 'edge' | 'unknown';
/**
 * Analyses `package.json` dependencies (and a few project-root files) to
 * classify the project's runtime environment.
 *
 * Priority order:
 *   1. Edge / serverless markers  → `'edge'`   (no filesystem)
 *   2. Frontend framework or bundler → `'browser'`
 *   3. Node.js server framework   → `'node-server'`
 *   4. Fallback                   → `'unknown'`
 */
export declare function detectProjectEnvironment(): Promise<ProjectEnvironment>;
/**
 * Checks if the project uses TypeScript (looks for tsconfig.json).
 */
export declare function isProjectUsingTypeScript(): Promise<boolean>;
/**
 * Searches the common locations (`src/` and the project root) for an existing
 * i18n initialization file.
 *
 * @returns The path of the first init file found (relative to cwd, native
 *          platform separators), or null.
 */
export declare function findExistingI18nInitFile(): Promise<string | null>;
/**
 * Extracts and writes translation keys discovered during instrumentation.
 */
export declare function writeExtractedKeys(candidates: CandidateString[], config: I18nextToolkitConfig, namespace?: string, logger?: Logger): Promise<void>;
//# sourceMappingURL=instrumenter.d.ts.map