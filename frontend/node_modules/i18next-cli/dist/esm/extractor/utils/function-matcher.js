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
function matchesFunctionPattern(functionName, pattern) {
    if (pattern === functionName)
        return true;
    // Prefix wildcard, e.g. '*.t' -> matches any callee ending in '.t'
    if (pattern.startsWith('*.')) {
        return functionName.endsWith(pattern.slice(1));
    }
    // Suffix wildcard, e.g. 'tProps.*' -> matches 'tProps.<segment>'
    if (pattern.endsWith('.*')) {
        const prefix = pattern.slice(0, -1); // keep the trailing dot: 'tProps.'
        if (!functionName.startsWith(prefix))
            return false;
        const rest = functionName.slice(prefix.length);
        return rest.length > 0 && !rest.includes('.');
    }
    return false;
}

export { matchesFunctionPattern };
