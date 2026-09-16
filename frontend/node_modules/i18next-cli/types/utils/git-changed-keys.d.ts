/**
 * Resolves the git ref to compare against for --changed-only.
 *
 * Returns the resolved base branch (for messaging) and the merge-base of that
 * ref and HEAD — the commit where the current branch diverged — so commits
 * landing on the base branch after the branch point are not attributed to this
 * branch (the semantics of `git diff base...HEAD`). Falls back to the base tip
 * when merge-base cannot be computed (e.g. shallow clones).
 *
 * Throws with an actionable message when git is unavailable, the cwd is not
 * inside a repository, or no base ref can be resolved.
 */
export declare function resolveGitCompareRef(base?: string): {
    base: string;
    compareRef: string;
};
/**
 * Returns the content of a file at the given ref, or `null` when the file did
 * not exist there (a file new on this branch). Existence is checked via
 * cat-file's exit code instead of matching `git show`'s stderr, which is
 * localized.
 */
export declare function readFileAtRef(compareRef: string, filePath: string): string | null;
/**
 * Parses translation file content from a string (git blob) using the same
 * parsers as loadTranslationFile. JS/TS resource modules cannot be evaluated
 * from git history, so --changed-only does not support them.
 */
export declare function parseTranslationContent(content: string, filePath: string): Record<string, any>;
/**
 * Builds a matcher deciding whether a key belongs to the changed set.
 *
 * Plural grouping: when ANY variant of a base key changed, ALL variants of
 * that base key match. Source and target languages have different CLDR plural
 * category counts (en: one/other; ar: zero..other), so an exact-key match
 * would drop the target-only forms. Covers cardinal and ordinal CLDR suffixes
 * plus the legacy v3 forms (_plural, _0, _1, ...). Kept in sync with the
 * sister copy in locize-cli (src/gitChangedKeys.js).
 *
 * The caller is expected to keep changed sets scoped per source FILE: the same
 * bare key name in two files (e.g. each email template having its own
 * `subject`) must not cross-match.
 */
export declare function makeChangedKeyMatcher(changedKeys: Set<string>, pluralSeparator?: string): (key: string) => boolean;
//# sourceMappingURL=git-changed-keys.d.ts.map