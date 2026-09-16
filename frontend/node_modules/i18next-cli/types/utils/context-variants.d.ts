/**
 * Helpers for reasoning about context variants of translation keys.
 *
 * A "key accepting context" is a base key that was called with a `context`
 * option in source code (e.g. `t('friend', { context: gender })`). Its
 * variants in the translation file look like `<base><contextSeparator><ctx>`
 * (optionally suffixed with a CLDR plural form).
 */
/**
 * Checks if an existing key is a context variant of a base key that accepts context.
 * Handles:
 * - Keys suffixed with a CLDR plural form (e.g. `friend_male_one`).
 * - Context values that contain the separator (e.g. `mc_laren`).
 *
 * @param existingKey - The key from the translation file to check
 * @param keysAcceptingContext - Set of base keys that were used with context in source code
 * @param pluralSeparator - The separator used for plural forms (default: '_')
 * @param contextSeparator - The separator used for context variants (default: '_')
 * @returns true if the existing key is a context variant of a key accepting context
 */
export declare function isContextVariantOfAcceptingKey(existingKey: string, keysAcceptingContext: ReadonlySet<string>, pluralSeparator: string, contextSeparator: string): boolean;
//# sourceMappingURL=context-variants.d.ts.map