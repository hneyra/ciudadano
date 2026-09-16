/**
 * Shared parser for i18next-style nested translation references of the form
 * `$t(key, { options })`.
 *
 * Used in two places:
 * 1. The extractor's AST pass scans source-code keys and default values for
 *    nested references and registers the referenced keys (so they show up in
 *    output translation files).
 * 2. The translation-manager uses it during `removeUnusedKeys` cleanup so
 *    keys that are only referenced from inside a translation value (and thus
 *    invisible to the AST pass) are preserved instead of being deleted.
 */
export interface NestingConfig {
    nestingPrefix?: string;
    nestingSuffix?: string;
    nestingOptionsSeparator?: string;
    nsSeparator?: string | false | null;
    defaultNS?: string | false;
}
export interface NestedReference {
    /** The referenced key (namespace-stripped when a namespace was resolved). */
    key: string;
    /** Resolved namespace for the reference (or defaultNS / undefined). */
    ns: string | false | undefined;
    /** True when the nested options object contains a `count` property. */
    hasCount: boolean;
    /** Static context string, if the nested options contain `context: 'foo'`. */
    context?: string;
}
/**
 * Scans a string for `$t(...)` references and returns metadata about each one.
 * The implementation mirrors the behaviour of i18next's Interpolator so that
 * the extractor and translation manager agree on what counts as a reference.
 */
export declare function parseNestedReferences(text: string, config: NestingConfig): NestedReference[];
//# sourceMappingURL=nesting.d.ts.map