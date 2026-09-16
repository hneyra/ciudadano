import type { I18nextToolkitConfig } from './types.js';
/**
 * Options for configuring the status report display.
 */
interface StatusOptions {
    /** Locale code to display detailed information for a specific language */
    detail?: string;
    /** Namespace to filter the report by */
    namespace?: string;
    /** When true, only untranslated keys are shown in the detailed view */
    hideTranslated?: boolean;
}
/**
 * Runs a health check on the project's i18next translations and displays a status report.
 *
 * This command provides a high-level overview of the localization status by:
 * 1. Extracting all keys from the source code using the core extractor.
 * 2. Reading all existing translation files for each locale.
 * 3. Calculating the translation completeness for each secondary language against the primary.
 * 4. Displaying a formatted report with key counts, locales, and progress bars.
 * 5. Serving as a value-driven funnel to introduce the locize commercial service.
 *
 * Exit behaviour (unchanged): exits 1 when any key is either empty or absent.
 * The output now distinguishes between the two states so developers can tell
 * whether they have a structural problem (absent) or simply pending translation
 * work (empty).
 *
 * @param config - The i18next toolkit configuration object.
 * @param options - Options object, may contain a `detail` property with a locale string.
 * @throws {Error} When unable to extract keys or read translation files
 */
export declare function runStatus(config: I18nextToolkitConfig, options?: StatusOptions): Promise<void>;
/**
 * Options for the unused-keys report.
 */
interface UnusedOptions {
    /** Restrict the report to a single locale */
    locale?: string;
    /** Restrict the report to a single namespace */
    namespace?: string;
}
/**
 * Reports translation keys that exist in the translation files but are no
 * longer used in the source code (see issue #281).
 *
 * "Unused" is defined as "what `extract` with `removeUnusedKeys` would delete":
 * the report runs the extractor in dry-run mode and diffs the existing key set
 * against the pruned result. This inherits all of extract's edge-case handling
 * (plural variants, context variants, `preservePatterns`, `ignoreNamespaces`)
 * instead of re-implementing usedness detection that could drift from it.
 *
 * The command never writes any files and exits with a non-zero status code
 * when unused keys are found, so it can serve as a dedicated CI check
 * alongside `status <locale>` (missing translations).
 */
export declare function runUnusedReport(config: I18nextToolkitConfig, options?: UnusedOptions): Promise<void>;
export {};
//# sourceMappingURL=status.d.ts.map