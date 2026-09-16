/**
 * Interactive setup wizard for creating a new i18next-cli configuration file.
 *
 * This function provides a guided setup experience that:
 * 1. Asks the user for their preferred configuration file type (TypeScript or JavaScript)
 * 2. Collects basic project settings (locales, input patterns, output paths)
 * 3. Detects the project module system (ESM vs CommonJS) for JavaScript files
 * 4. Generates an appropriate configuration file with proper syntax
 * 5. Provides helpful defaults for common use cases
 *
 * The generated configuration includes:
 * - Locale specification
 * - Input file patterns for source scanning
 * - Output path templates with placeholders
 * - Proper imports and exports for the detected module system
 * - JSDoc type annotations for JavaScript files
 *
 * @example
 * ```typescript
 * // Run the interactive setup
 * await runInit()
 *
 * // This will create either:
 * // - i18next.config.ts (TypeScript)
 * // - i18next.config.js (JavaScript ESM/CommonJS)
 * ```
 */
export interface InitOptions {
    /** Skip the browser launch when Locize is selected; print the signup URL instead. */
    ci?: boolean;
    /** Also scaffold an inlang project; skips the corresponding question. */
    inlang?: boolean;
    /** Non-interactive: take the detected defaults for every answer not given as an option; never prompts. */
    yes?: boolean;
    /** Comma-separated locales, e.g. `en,de,fr`. */
    locales?: string;
    /** Source-file glob. */
    input?: string;
    /** Output path template. */
    output?: string;
    /** Translation backend. With `locize`, the project id comes from `projectId` or `LOCIZE_PROJECTID`; without either the wizard asks (interactive) or skips the block (`--yes`). */
    backend?: 'local' | 'locize' | 'other';
    /** Locize project id; skips the signup page and the credential prompts. The API key stays in `LOCIZE_API_KEY`. */
    projectId?: string;
    /** Config file type. */
    fileType?: 'ts' | 'js';
    /** `true` writes the agent note without asking, `false` skips the question, `undefined` asks. */
    agentNote?: boolean;
}
export declare function runInit(options?: InitOptions): Promise<void>;
//# sourceMappingURL=init.d.ts.map