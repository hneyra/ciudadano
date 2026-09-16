/**
 * Checks whether a (possibly dotted) function name matches a configured
 * `functions` pattern.
 *
 * Supported pattern forms:
 * - Exact match: `'t'` matches `t`, `'i18next.t'` matches `i18next.t`.
 * - Prefix wildcard: `'*.t'` matches any call ending in `.t`
 *   (e.g. `i18n.t`, `this._i18n.t`).
 * - Suffix wildcard: `'tProps.*'` matches any single-segment member call on the
 *   prefix (e.g. `tProps.label`, `tProps.title`) but not deeper nesting like
 *   `tProps.label.t`.
 *
 * @param functionName - The dotted callee name (e.g. `tProps.label`).
 * @param pattern - A single configured pattern from `extract.functions`.
 */
export declare function matchesFunctionPattern(functionName: string, pattern: string): boolean;
/**
 * Checks whether a function name matches any of the configured patterns.
 *
 * @param functionName - The dotted callee name (e.g. `tProps.label`).
 * @param patterns - The configured `extract.functions` patterns.
 */
export declare function matchesAnyFunctionPattern(functionName: string, patterns: string[]): boolean;
//# sourceMappingURL=function-matcher.d.ts.map