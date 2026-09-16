'use strict';

var node_path = require('node:path');
var glob = require('glob');
var nestedObject = require('../../utils/nested-object.js');
var fileUtils = require('../../utils/file-utils.js');
var defaultValue = require('../../utils/default-value.js');
var logger = require('../../utils/logger.js');
var pluralRules = require('../../utils/plural-rules.js');
var nesting = require('../../utils/nesting.js');
var contextVariants = require('../../utils/context-variants.js');

// used for natural language check
const chars = [' ', ',', '?', '!', ';'];
const pluralForms = ['zero', 'one', 'two', 'few', 'many', 'other'];
/**
 * Converts a glob pattern to a regular expression for matching keys
 * @param glob - The glob pattern to convert
 * @returns A RegExp object that matches the glob pattern
 */
function globToRegex(glob) {
    const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const regexString = `^${escaped.replace(/\*/g, '.*')}$`;
    return new RegExp(regexString);
}
/**
 * Checks if a key looks like an object path or natural language.
 * (like in i18next)
 */
function looksLikeObjectPath(key, separator, regex) {
    if (!regex)
        return true;
    let matched = !regex.test(key);
    if (!matched) {
        const ki = key.indexOf(separator);
        if (ki > 0 && !regex.test(key.substring(0, ki))) {
            matched = true;
        }
    }
    return matched;
}
/**
 * Returns true when splitting `key` by `separator` would produce at least one
 * empty string segment (e.g. "Loading..." split by "." → ["Loading","","",""]).
 * Keys with empty segments must be treated as flat keys, not nested paths,
 * otherwise they create `{ "": { "": "..." } }` entries in the JSON output.
 */
function hasEmptySegments(key, separator) {
    return key.split(separator).some(s => s === '');
}
/**
 * Detects a nesting conflict for `key` against the object being built.
 * Returns the conflicting ancestor/descendant key path as a string when a
 * conflict is found, or `null` when there is no conflict.
 *
 * The returned string lets callers produce an actionable error message
 * pointing to the specific key that is already occupying the conflicting path.
 */
function findNestingConflict(obj, key, separator) {
    const parts = key.split(separator);
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const value = current[part];
        if (value === undefined || value === null) {
            // Path does not exist yet — no conflict
            return null;
        }
        if (typeof value !== 'object' || Array.isArray(value)) {
            // A non-object value already occupies an ancestor segment.
            // We cannot nest inside a string/number/array.
            return parts.slice(0, i + 1).join(separator);
        }
        current = value;
    }
    // Check the final segment: if the existing value is a non-empty object and we are
    // about to overwrite it with a string, that is also a conflict (the deeper keys
    // that populate this object came from other extracted keys and would be silently lost).
    const leafPart = parts[parts.length - 1];
    const leafValue = current[leafPart];
    if (typeof leafValue === 'object' && leafValue !== null && !Array.isArray(leafValue) && Object.keys(leafValue).length > 0) {
        // The conflicting path is the key itself (it already has nested children)
        return key;
    }
    return null;
}
/**
 * Recursively sorts the keys of an object.
 */
function sortObject(obj, config, customSort) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        return obj;
    }
    const sortedObj = {};
    const pluralSeparator = config?.extract?.pluralSeparator ?? '_';
    // Define the canonical order for plural forms
    const ordinalPluralOrder = pluralForms.map(form => `ordinal${pluralSeparator}${form}`);
    // Helper function to extract base key and its rank within that base.
    // Rank orders the variants of one base key: the plain key first, then the
    // cardinal plural forms in canonical order, then the ordinal ones.
    const getKeyInfo = (key) => {
        // Handle ordinal plurals: key_ordinal_form or key_context_ordinal_form
        for (const form of ordinalPluralOrder) {
            if (key.endsWith(`${pluralSeparator}${form}`)) {
                const base = key.slice(0, -(pluralSeparator.length + form.length));
                return { base, rank: pluralForms.length + ordinalPluralOrder.indexOf(form) };
            }
        }
        // Handle cardinal plurals: key_form or key_context_form
        for (const form of pluralForms) {
            if (key.endsWith(`${pluralSeparator}${form}`)) {
                const base = key.slice(0, -(pluralSeparator.length + form.length));
                return { base, rank: pluralForms.indexOf(form) };
            }
        }
        return { base: key, rank: -1 };
    };
    const compareKeys = (a, b) => {
        if (customSort)
            return customSort(a, b);
        // Default: case-insensitive, then by case
        const caseInsensitiveComparison = a.localeCompare(b, undefined, { sensitivity: 'base' });
        if (caseInsensitiveComparison === 0) {
            return a.localeCompare(b, undefined, { sensitivity: 'case' });
        }
        return caseInsensitiveComparison;
    };
    const keys = Object.keys(obj).sort((a, b) => {
        const aInfo = getKeyInfo(a);
        const bInfo = getKeyInfo(b);
        // Always compare by base key first. Comparing base keys for plural/plural
        // pairs but full keys for every other pair made the comparator
        // intransitive, so the result depended on the input order and `extract`
        // was not idempotent (#279).
        if (aInfo.base !== bInfo.base) {
            const baseComparison = compareKeys(aInfo.base, bInfo.base);
            if (baseComparison !== 0)
                return baseComparison;
        }
        // Same base key: plain key, cardinal plurals, then ordinal plurals
        if (aInfo.rank !== bInfo.rank)
            return aInfo.rank - bInfo.rank;
        return compareKeys(a, b);
    });
    for (const key of keys) {
        sortedObj[key] = sortObject(obj[key], config, customSort);
    }
    return sortedObj;
}
/**
 * Recursively sorts object keys in plain UTF-16 code-unit order
 * (Array.prototype.sort without comparator) — the exact order locize uses
 * when publishing namespace files.
 */
function sortObjectCodeUnit(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        return obj;
    }
    const sorted = {};
    for (const key of Object.keys(obj).sort()) {
        sorted[key] = sortObjectCodeUnit(obj[key]);
    }
    return sorted;
}
/**
 * A helper function to build a new translation object for a single namespace.
 * This centralizes the core logic of merging keys.
 */
function buildNewTranslationsForNs(nsKeys, existingTranslations, config, locale, namespace, preservePatterns = [], objectKeys = new Set(), syncPrimaryWithDefaults = false, syncAll = false, trustDerivedDefaults = false, primaryExistingTranslations = {}, logger$1 = new logger.ConsoleLogger()) {
    const { keySeparator = '.', sort = true, removeUnusedKeys = true, defaultValue: emptyDefaultValue = '', pluralSeparator = '_', contextSeparator = '_', preserveContextVariants = false, } = config.extract;
    const primaryLanguage = config.extract.primaryLanguage || config.locales[0] || 'en';
    const nsSep = typeof config.extract.nsSeparator === 'string' ? config.extract.nsSeparator : ':';
    // Keep the raw configured defaultValue so we can distinguish:
    // - "not provided" (undefined) vs
    // - "provided as empty string" ('')
    const configuredDefaultValue = config.extract.defaultValue;
    // Treat "defaultValue that equals the key (or a suffix of it)" as a derived fallback.
    // This happens for:
    // - plain calls without a code default: t('hello')
    // - keyPrefix calls where the stored key is prefixed but defaultValue is the unprefixed part:
    //   key="nested.another.key", defaultValue="another.key"
    const isDerivedFromKey = (key, defaultValue, explicitDefault) => {
        if (explicitDefault)
            return false;
        if (defaultValue === undefined || defaultValue === null)
            return true;
        const dv = String(defaultValue);
        // Exact fallback
        if (dv === key)
            return true;
        // Namespace:key fallback
        if (nsSep && namespace && dv === `${namespace}${nsSep}${key}`)
            return true;
        // keyPrefix-style fallback: defaultValue is a suffix of the full key
        // Example: key="nested.key", dv="key"  OR  key="nested.another.key", dv="another.key"
        if (typeof keySeparator === 'string' && keySeparator.length > 0) {
            if (key.endsWith(`${keySeparator}${dv}`))
                return true;
        }
        // Plural/context variants sometimes store base as default; keep existing logic parity
        if (dv && key !== dv) {
            if (key.startsWith(dv + pluralSeparator))
                return true;
            if (key.startsWith(dv + contextSeparator))
                return true;
        }
        return false;
    };
    // Prepare regex for natural language detection
    const possibleChars = chars.filter((c) => nsSep.indexOf(c) < 0 && (typeof keySeparator === 'string' ? keySeparator.indexOf(c) < 0 : true));
    const naturalLanguageRegex = possibleChars.length > 0
        ? new RegExp(`(${possibleChars.map((c) => (c === '?' ? '\\?' : c)).join('|')})`)
        : null;
    // Build a set of base keys that accept context (only if preserveContextVariants is enabled)
    // These are keys that were called with a context parameter in the source code
    const keysAcceptingContext = new Set();
    if (preserveContextVariants) {
        for (const { keyAcceptingContext } of nsKeys) {
            if (keyAcceptingContext) {
                keysAcceptingContext.add(keyAcceptingContext);
            }
        }
    }
    // Get the plural categories for the target language (only used for filtering extracted keys)
    // safePluralRules falls back to 'en' for non-BCP47 custom locale codes (e.g. 'E', 'F')
    const targetLanguagePluralCategories = new Set();
    const cardinalRules = pluralRules.safePluralRules(locale, { type: 'cardinal' });
    const ordinalRules = pluralRules.safePluralRules(locale, { type: 'ordinal' });
    // Track cardinal plural categories separately so we can special-case single-"other" languages
    const cardinalCategories = cardinalRules.resolvedOptions().pluralCategories;
    cardinalCategories.forEach(cat => targetLanguagePluralCategories.add(cat));
    ordinalRules.resolvedOptions().pluralCategories.forEach(cat => targetLanguagePluralCategories.add(`ordinal_${cat}`));
    // Plural categories of the primary language — used to recognise locale-specific
    // plural variants (e.g. French `_many` when primary is English) so we don't
    // treat their absence from the primary file as a "divergence" during --sync-all.
    const primaryCardinalCategoriesSet = new Set(pluralRules.safePluralRules(primaryLanguage, { type: 'cardinal' }).resolvedOptions().pluralCategories);
    const primaryOrdinalCategoriesSet = new Set(pluralRules.safePluralRules(primaryLanguage, { type: 'ordinal' }).resolvedOptions().pluralCategories);
    // When allPluralForms is enabled, compute the union of cardinal categories across all configured locales.
    // This ensures every locale gets the same set of plural keys — but only the forms actually needed by at least one locale.
    const allLocalesCardinalCategories = config.extract.allPluralForms
        ? (() => {
            const union = new Set();
            for (const loc of config.locales) {
                pluralRules.safePluralRules(loc, { type: 'cardinal' }).resolvedOptions().pluralCategories.forEach(c => union.add(c));
            }
            return [...union];
        })()
        : null;
    // Discover keys that are only referenced through `$t(...)` nested references
    // inside existing translation values (see issue #241). These keys are
    // invisible to the AST-based extractor, so without this step they would be
    // deleted when `removeUnusedKeys` is true and never expanded into the plural
    // forms a secondary locale needs.
    //
    // We inject synthetic ExtractedKey entries for each discovered reference so
    // the normal filter / plural-expansion pipeline picks them up — for the
    // primary language this preserves the existing variants, and for secondary
    // languages this generates the correct per-locale plural skeleton.
    const syntheticNestedKeys = [];
    const namespaceMatches = (refNs) => {
        if (namespace === undefined)
            return true;
        // Nested references arrive from parseNestedReferences with `ns` either set
        // from an explicit `ns:key` prefix or defaulted to config.extract.defaultNS.
        // Normalise to the same bucket keys used in `keysByNS`.
        const normalizedRef = refNs === undefined || refNs === null
            ? config.extract.defaultNS ?? 'translation'
            : refNs;
        return normalizedRef === namespace;
    };
    // All cardinal plural categories we should expand to for a context+count
    // nested reference, covering every configured locale so the per-locale
    // filter can then keep only the relevant ones.
    const nestedContextCountCategories = (() => {
        const union = new Set();
        for (const loc of config.locales) {
            pluralRules.safePluralRules(loc, { type: 'cardinal' }).resolvedOptions().pluralCategories.forEach(c => union.add(c));
        }
        return [...union];
    })();
    const seenNestedValues = new Set();
    const collectFromValue = (value) => {
        if (typeof value === 'string') {
            if (seenNestedValues.has(value))
                return;
            seenNestedValues.add(value);
            const refs = nesting.parseNestedReferences(value, {
                nestingPrefix: config.extract.nestingPrefix,
                nestingSuffix: config.extract.nestingSuffix,
                nestingOptionsSeparator: config.extract.nestingOptionsSeparator,
                nsSeparator: config.extract.nsSeparator,
                defaultNS: config.extract.defaultNS
            });
            for (const ref of refs) {
                if (!namespaceMatches(ref.ns))
                    continue;
                const effectiveHasCount = ref.hasCount && !config.extract.disablePlurals;
                if (ref.context !== undefined) {
                    const ctxKey = `${ref.key}${contextSeparator}${ref.context}`;
                    if (effectiveHasCount) {
                        // `ctxKey` contains `contextSeparator` (which equals pluralSeparator
                        // by default) so we cannot hand it to the base plural expansion
                        // pass. Instead, push fully-expanded variants and rely on the
                        // per-locale filter to keep the relevant ones.
                        for (const category of nestedContextCountCategories) {
                            syntheticNestedKeys.push({
                                key: `${ctxKey}${pluralSeparator}${category}`,
                                hasCount: true,
                                isExpandedPlural: true
                            });
                        }
                    }
                    else {
                        syntheticNestedKeys.push({ key: ref.key });
                        syntheticNestedKeys.push({ key: ctxKey });
                    }
                }
                else if (effectiveHasCount) {
                    // Plain plural reference — push the base plural key and let the
                    // normal expansion in the main loop emit per-locale variants.
                    syntheticNestedKeys.push({ key: ref.key, hasCount: true });
                }
                else {
                    syntheticNestedKeys.push({ key: ref.key });
                }
            }
        }
        else if (value && typeof value === 'object' && !Array.isArray(value)) {
            for (const v of Object.values(value)) {
                collectFromValue(v);
            }
        }
    };
    // Scan both the locale being built and the primary locale so that newly
    // introduced references are propagated to every locale on the first run.
    collectFromValue(existingTranslations);
    if (primaryExistingTranslations && primaryExistingTranslations !== existingTranslations) {
        collectFromValue(primaryExistingTranslations);
    }
    const nsKeysWithNested = syntheticNestedKeys.length > 0
        ? [...nsKeys, ...syntheticNestedKeys]
        : nsKeys;
    // Prepare namespace pattern checking helpers
    const rawPreserve = config.extract.preservePatterns || [];
    // Fast equivalent of matching a `${objectKey}.*` glob per object key: instead of
    // testing O(objectKeys) regexes per key, walk the key's '.' boundaries and look
    // each ancestor prefix up in the Set — O(key depth). See issue #286.
    const isUnderObjectKey = (key) => {
        if (objectKeys.size === 0)
            return false;
        let i = key.indexOf('.');
        while (i !== -1) {
            if (objectKeys.has(key.slice(0, i)))
                return true;
            i = key.indexOf('.', i + 1);
        }
        return false;
    };
    // Helper to check if a key should be filtered out during extraction
    const shouldFilterKey = (key) => {
        // 1) keys nested under a returnObjects / selector-API base key
        if (isUnderObjectKey(key)) {
            return true;
        }
        // 2) regex based patterns (existing behavior)
        if (preservePatterns.some(re => re.test(key))) {
            return true;
        }
        // 3) namespace:* style patterns (respect nsSeparator)
        for (const rp of rawPreserve) {
            if (typeof rp !== 'string')
                continue;
            if (rp.endsWith(`${nsSep}*`)) {
                const nsPrefix = rp.slice(0, -(nsSep.length + 1));
                // If namespace is provided to this builder, and pattern targets this namespace, skip keys from this ns
                // Support wildcard namespace '*' to match any namespace
                if (nsPrefix === '*' || (namespace && nsPrefix === namespace)) {
                    return true;
                }
            }
        }
        return false;
    };
    // Helper to check if an existing key should be preserved
    const shouldPreserveExistingKey = (key) => {
        // 1) keys nested under a returnObjects / selector-API base key
        if (isUnderObjectKey(key)) {
            return true;
        }
        // 2) regex-style patterns
        if (preservePatterns.some(re => re.test(key))) {
            return true;
        }
        // 3) namespace:key patterns - check if pattern matches this namespace:key combination
        for (const rp of rawPreserve) {
            if (typeof rp !== 'string')
                continue;
            // Handle namespace:* patterns
            if (rp.endsWith(`${nsSep}*`)) {
                const nsPrefix = rp.slice(0, -(nsSep.length + 1));
                if (nsPrefix === '*' || (namespace && nsPrefix === namespace)) {
                    return true;
                }
            }
            // Handle namespace:specificKey patterns (e.g., 'other:okey', 'other:second*')
            if (rp.includes(nsSep) && namespace) {
                const [patternNs, patternKey] = rp.split(nsSep);
                if (patternNs === namespace) {
                    // Convert the key part to regex (handle wildcards)
                    const keyRegex = globToRegex(patternKey);
                    if (keyRegex.test(key)) {
                        return true;
                    }
                }
            }
        }
        return false;
    };
    // Filter nsKeys to only include keys relevant to this language
    const filteredKeys = nsKeysWithNested.filter(({ key, hasCount, isOrdinal, explicitDefault }) => {
        // FIRST: Check if key matches preservePatterns and should be excluded
        if (shouldFilterKey(key)) {
            return false;
        }
        if (!hasCount || config.extract.disablePlurals) {
            // Non-plural keys are always included. Under `disablePlurals`, count keys
            // are emitted as plain keys (no plural expansion) but still carry
            // `hasCount` so `status` can recognise them — they must bypass the
            // plural-form filtering below and always be included, exactly as before.
            return true;
        }
        // For plural keys, check if this specific plural form is needed for the target language
        const keyParts = key.split(pluralSeparator);
        // If this is a base plural key (no plural suffix), keep it so that the
        // builder can expand it to the target locale's plural forms.
        if (hasCount && keyParts.length === 1) {
            return true;
        }
        // Special-case single-cardinal-"other" languages (ja/zh/ko etc.):
        // when the target language's cardinal categories are exactly ['other'],
        // the extractor may have emitted the base key (no "_other" suffix).
        // Accept the base key in that situation, while still accepting explicit *_other variants.
        if (cardinalCategories.length === 1 && cardinalCategories[0] === 'other') {
            // If this is a plain/base key (no plural suffix), include it.
            if (keyParts.length === 1)
                return true;
            // Otherwise fall through and check the explicit suffix as before.
        }
        // i18next supports a special _zero form that is NOT part of CLDR plural
        // rules. When the key was explicitly extracted (e.g. from a t() call with
        // `defaultValue_zero`), always include it regardless of the target
        // language's Intl.PluralRules categories.
        // See: https://www.i18next.com/translation-function/plurals#special-zero
        const lastPart = keyParts[keyParts.length - 1];
        if (lastPart === 'zero' && explicitDefault) {
            return true;
        }
        // When allPluralForms is enabled, include all CLDR plural forms regardless of the target language
        if (allLocalesCardinalCategories && allLocalesCardinalCategories.includes(lastPart)) {
            return true;
        }
        if (isOrdinal && keyParts.includes('ordinal')) {
            // For ordinal plurals: key_context_ordinal_category or key_ordinal_category
            return targetLanguagePluralCategories.has(`ordinal_${lastPart}`);
        }
        else if (hasCount) {
            // For cardinal plurals: key_context_category or key_category
            return targetLanguagePluralCategories.has(lastPart);
        }
        return true;
    });
    // NEW: detect bases that already have expanded plural variants extracted.
    // If a base has explicit expanded variants (e.g. key_one, key_other or key_ordinal_one),
    // we should avoid generating/expanding the base plural key for that base to prevent
    // double-generation / duplicate counting.
    const expandedBases = new Set();
    for (const ek of filteredKeys) {
        if (ek.isExpandedPlural) {
            const parts = String(ek.key).split(pluralSeparator);
            // If ordinal form like "key_ordinal_one" -> base should strip "_ordinal_<cat>"
            if (parts.length >= 3 && parts[parts.length - 2] === 'ordinal') {
                expandedBases.add(parts.slice(0, -2).join(pluralSeparator));
            }
            else {
                // strip single trailing category
                expandedBases.add(parts.slice(0, -1).join(pluralSeparator));
            }
        }
    }
    // If `removeUnusedKeys` is true, start with an empty object. Otherwise, start with a clone of the existing translations.
    let newTranslations = removeUnusedKeys
        ? {}
        : JSON.parse(JSON.stringify(existingTranslations));
    // Preserve keys that match the configured patterns OR are context variants of keys accepting context
    const existingKeys = nestedObject.getNestedKeys(existingTranslations, keySeparator ?? '.');
    for (const existingKey of existingKeys) {
        const shouldPreserve = shouldPreserveExistingKey(existingKey);
        const isContextVariant = !shouldPreserve && contextVariants.isContextVariantOfAcceptingKey(existingKey, keysAcceptingContext, pluralSeparator, contextSeparator);
        if (shouldPreserve || (preserveContextVariants && isContextVariant)) {
            const value = nestedObject.getNestedValue(existingTranslations, existingKey, keySeparator ?? '.');
            nestedObject.setNestedValue(newTranslations, existingKey, value, keySeparator ?? '.');
        }
    }
    // PROPAGATE CONTEXT VARIANTS FROM PRIMARY TO SECONDARY (issue #242):
    // When `preserveContextVariants` is enabled and the source code uses a
    // dynamic context value (e.g. `t('exportType', { context: type })`), the
    // extractor tags the base key as "accepting context" but the actual context
    // values (e.g. `gas`, `water`) are only known from the primary translation
    // file. Propagate those variants from primary to secondary locales so every
    // locale ends up with the same key skeleton — translators and downstream
    // `sync` can then fill in real values.
    if (preserveContextVariants && locale !== primaryLanguage && primaryExistingTranslations) {
        const primaryKeys = nestedObject.getNestedKeys(primaryExistingTranslations, keySeparator ?? '.');
        for (const primaryKey of primaryKeys) {
            if (shouldFilterKey(primaryKey))
                continue;
            const isContextVariant = contextVariants.isContextVariantOfAcceptingKey(primaryKey, keysAcceptingContext, pluralSeparator, contextSeparator);
            if (!isContextVariant)
                continue;
            const separator = primaryKey.startsWith('<') ? false : (keySeparator ?? '.');
            const alreadySet = nestedObject.getNestedValue(newTranslations, primaryKey, separator);
            if (alreadySet !== undefined)
                continue;
            // Prefer an existing secondary value if present, otherwise fall back to
            // the configured defaultValue (empty string for secondaries by default).
            const existingSecondaryValue = nestedObject.getNestedValue(existingTranslations, primaryKey, separator);
            const valueToSet = existingSecondaryValue !== undefined
                ? existingSecondaryValue
                : defaultValue.resolveDefaultValue(emptyDefaultValue, primaryKey, namespace || config?.extract?.defaultNS || 'translation', locale);
            nestedObject.setNestedValue(newTranslations, primaryKey, valueToSet, separator);
        }
    }
    // PRESERVE LOCALE-SPECIFIC PLURAL FORMS: When dealing with plural keys in non-primary locales,
    // preserve any existing plural forms that are NOT being explicitly generated.
    // This ensures that locale-specific forms (like _few, _many) added by translators are preserved.
    if (locale !== primaryLanguage && removeUnusedKeys) {
        const existingKeys = nestedObject.getNestedKeys(existingTranslations, keySeparator ?? '.');
        for (const existingKey of existingKeys) {
            // Check if this is a plural form variant (ends with _form)
            let isPluralForm = false;
            let baseKey = existingKey;
            let foundForm = '';
            for (const form of pluralForms) {
                if (existingKey.endsWith(`${pluralSeparator}${form}`)) {
                    baseKey = existingKey.slice(0, -(pluralSeparator.length + form.length));
                    foundForm = form;
                    isPluralForm = true;
                    break;
                }
            }
            if (isPluralForm && foundForm) {
                // Check if the base key is in our filtered keys (meaning it's a plural key we're handling)
                const isBaseInExtracted = filteredKeys.some(({ key }) => {
                    let extractedBase = key;
                    for (const form of pluralForms) {
                        if (extractedBase.endsWith(`${pluralSeparator}${form}`)) {
                            extractedBase = extractedBase.slice(0, -(pluralSeparator.length + form.length));
                            break;
                        }
                    }
                    return extractedBase === baseKey;
                });
                if (isBaseInExtracted) {
                    // This is a plural form for a key we're handling.
                    // Check if it's already in newTranslations (will be set by the normal flow)
                    const isAlreadySet = nestedObject.getNestedValue(newTranslations, existingKey, keySeparator ?? '.') !== undefined;
                    if (!isAlreadySet) {
                        // This plural form is NOT being generated by our code, so preserve it
                        const value = nestedObject.getNestedValue(existingTranslations, existingKey, keySeparator ?? '.');
                        nestedObject.setNestedValue(newTranslations, existingKey, value, keySeparator ?? '.');
                    }
                }
            }
        }
    }
    // SPECIAL HANDLING: Preserve existing _zero forms even if not in extracted keys
    // This ensures that optional _zero forms are not removed when they exist
    if (removeUnusedKeys) {
        const existingKeys = nestedObject.getNestedKeys(existingTranslations, keySeparator ?? '.');
        for (const existingKey of existingKeys) {
            // Check if this is a _zero form that should be preserved
            const keyParts = existingKey.split(pluralSeparator);
            const lastPart = keyParts[keyParts.length - 1];
            if (lastPart === 'zero') {
                // Check if the base plural key exists in our extracted keys
                const baseKey = keyParts.slice(0, -1).join(pluralSeparator);
                const hasBaseInExtracted = filteredKeys.some(({ key }) => {
                    const extractedParts = key.split(pluralSeparator);
                    const extractedBase = extractedParts.slice(0, -1).join(pluralSeparator);
                    return extractedBase === baseKey;
                });
                if (hasBaseInExtracted) {
                    // Preserve the existing _zero form
                    const value = nestedObject.getNestedValue(existingTranslations, existingKey, keySeparator ?? '.');
                    nestedObject.setNestedValue(newTranslations, existingKey, value, keySeparator ?? '.');
                }
            }
        }
    }
    // Precompute every proper ancestor prefix (up to each keySeparator boundary) of the
    // extracted keys, so the per-key "is this a leaf?" check below is a single Set lookup
    // instead of an O(keys) scan per key. See issue #286.
    const parentPrefixesInNewKeys = new Set();
    if (typeof keySeparator === 'string') {
        for (const { key } of filteredKeys) {
            let i = key.indexOf(keySeparator);
            while (i !== -1 && i < key.length) {
                parentPrefixesInNewKeys.add(key.slice(0, i));
                i = key.indexOf(keySeparator, i + 1);
            }
        }
    }
    // 1. Build the object first, without any sorting.
    for (const { key, defaultValue: defaultValue$1, explicitDefault, hasCount, isExpandedPlural, isOrdinal } of filteredKeys) {
        // If this is a base plural key (hasCount true but not an already-expanded variant)
        // and we detected explicit expanded variants for this base, skip expanding the base.
        if (hasCount && !isExpandedPlural) {
            const parts = String(key).split(pluralSeparator);
            let base = key;
            if (parts.length >= 3 && parts[parts.length - 2] === 'ordinal') {
                base = parts.slice(0, -2).join(pluralSeparator);
            }
            else if (parts.length >= 2) {
                base = parts.slice(0, -1).join(pluralSeparator);
            }
            if (expandedBases.has(base)) {
                // Skip generating/expanding this base key because explicit expanded forms exist.
                continue;
            }
        }
        // If this is a base plural key (no explicit suffix), expand it into locale-specific plural variants.
        // For non-primary locales, we generate forms for that specific locale from CLDR.
        // Additionally, we generate empty placeholders for ALL other CLDR forms not in the target locale
        // (so translators can add them manually if needed).
        // When disablePlurals is true, skip plural expansion entirely and fall through to normal key handling.
        if (hasCount && !isExpandedPlural && !config.extract.disablePlurals) {
            const parts = String(key).split(pluralSeparator);
            const isBaseKey = parts.length === 1;
            if (isBaseKey) {
                // If explicit expanded variants exist, do not expand the base.
                const base = key;
                if (expandedBases.has(base)) ;
                else {
                    // Determine which plural forms to generate
                    let formsToGenerate;
                    if (locale !== primaryLanguage) {
                        // For non-primary locales:
                        // 1. Generate the forms that locale actually needs (or union of all locales' forms if allPluralForms is enabled)
                        formsToGenerate = allLocalesCardinalCategories ?? cardinalCategories;
                        // 2. Also prepare empty placeholders for all OTHER CLDR forms not in this locale
                        //    so translators can add them manually without --sync-primary removing them
                        const otherForms = pluralForms.filter(f => !cardinalCategories.includes(f));
                        // Process the locale-specific forms normally
                        for (const form of formsToGenerate) {
                            const finalKey = isOrdinal
                                ? `${base}${pluralSeparator}${form}`
                                : `${base}${pluralSeparator}${form}`;
                            const separator = finalKey.startsWith('<') ? false : (keySeparator ?? '.');
                            const existingVariantValue = nestedObject.getNestedValue(existingTranslations, finalKey, separator);
                            if (existingVariantValue === undefined) {
                                // Use the default value for secondary locale forms
                                let resolvedValue;
                                if (typeof defaultValue$1 === 'string') {
                                    resolvedValue = defaultValue$1;
                                }
                                else {
                                    resolvedValue = defaultValue.resolveDefaultValue(emptyDefaultValue, String(base), namespace || config?.extract?.defaultNS || 'translation', locale, defaultValue$1);
                                }
                                nestedObject.setNestedValue(newTranslations, finalKey, resolvedValue, separator);
                            }
                            else {
                                nestedObject.setNestedValue(newTranslations, finalKey, existingVariantValue, separator);
                            }
                        }
                        // Now process other CLDR forms: set empty placeholders for forms this locale doesn't use
                        // but preserve any that were manually added by translators
                        for (const form of otherForms) {
                            const finalKey = isOrdinal
                                ? `${base}${pluralSeparator}${form}`
                                : `${base}${pluralSeparator}${form}`;
                            const separator = finalKey.startsWith('<') ? false : (keySeparator ?? '.');
                            const existingVariantValue = nestedObject.getNestedValue(existingTranslations, finalKey, separator);
                            if (existingVariantValue !== undefined) {
                                // Preserve manually-added forms
                                nestedObject.setNestedValue(newTranslations, finalKey, existingVariantValue, separator);
                            }
                            // Don't generate empty placeholders - only generate what the locale needs and preserve what's manual
                        }
                    }
                    else {
                        // For primary language, only expand if it has multiple plural forms
                        // Single-"other" languages (ja, zh, ko) should NOT expand the base key (unless allPluralForms is enabled)
                        if (cardinalCategories.length === 1 && cardinalCategories[0] === 'other' && !allLocalesCardinalCategories) {
                            // Single-"other" language - don't expand, keep just the base key
                            formsToGenerate = [];
                        }
                        else {
                            // Multi-form language - expand to its plural forms (or union of all locales' forms if allPluralForms is enabled)
                            formsToGenerate = allLocalesCardinalCategories ?? cardinalCategories;
                            for (const form of formsToGenerate) {
                                const finalKey = isOrdinal
                                    ? `${base}${pluralSeparator}${form}`
                                    : `${base}${pluralSeparator}${form}`;
                                const separator = finalKey.startsWith('<') ? false : (keySeparator ?? '.');
                                const existingVariantValue = nestedObject.getNestedValue(existingTranslations, finalKey, separator);
                                if (existingVariantValue === undefined) {
                                    // Prefer explicit defaultValue extracted for this key; fall back to configured defaultValue
                                    let resolvedValue;
                                    if (typeof defaultValue$1 === 'string') {
                                        resolvedValue = defaultValue$1;
                                    }
                                    else {
                                        resolvedValue = defaultValue.resolveDefaultValue(emptyDefaultValue, String(base), namespace || config?.extract?.defaultNS || 'translation', locale, defaultValue$1);
                                    }
                                    nestedObject.setNestedValue(newTranslations, finalKey, resolvedValue, separator);
                                }
                                else {
                                    nestedObject.setNestedValue(newTranslations, finalKey, existingVariantValue, separator);
                                }
                            }
                        }
                    }
                    if (formsToGenerate && formsToGenerate.length > 0) {
                        // We've handled expansion for this base key; skip the normal single-key handling.
                        continue;
                    }
                    // else: formsToGenerate is empty (single-"other" primary language)
                    // Fall through to normal key handling below
                }
            }
        }
        // If the key looks like a serialized Trans component (starts with <), treat it as a flat key
        let separator = key.startsWith('<') ? false : (keySeparator ?? '.');
        if (separator && typeof separator === 'string') {
            if (!looksLikeObjectPath(key, separator, naturalLanguageRegex)) {
                // Natural-language key — treat as flat
                separator = false;
            }
            else if (hasEmptySegments(key, separator)) {
                // Splitting would produce empty-string segments (e.g. "Loading..." split by "."
                // yields ["Loading","","",""]). Storing those creates { "": { "": "…" } }
                // noise in the JSON, so treat the whole key as a flat leaf instead.
                separator = false;
            }
        }
        const existingValue = nestedObject.getNestedValue(existingTranslations, key, separator);
        const primaryExistingValue = locale === primaryLanguage
            ? existingValue
            : nestedObject.getNestedValue(primaryExistingTranslations, key, separator);
        // When keySeparator === false we are working with flat keys (no nesting).
        // Avoid concatenating false into strings (``${key}${false}`` => "keyfalse") which breaks the startsWith check.
        // For flat keys there cannot be nested children, so treat them as leaves.
        const isLeafInNewKeys = keySeparator === false
            ? true
            : !parentPrefixesInNewKeys.has(key);
        const isDerivedDefault = isDerivedFromKey(key, defaultValue$1, explicitDefault);
        // Determine if we should preserve an existing object
        const shouldPreserveObject = typeof existingValue === 'object' && existingValue !== null && (objectKeys.has(key) || // Explicit returnObjects
            !defaultValue$1 || defaultValue$1 === key // No explicit default or default equals key
        );
        const isStaleObject = typeof existingValue === 'object' && existingValue !== null && isLeafInNewKeys && !objectKeys.has(key) && !shouldPreserveObject;
        const primaryShouldPreserveObject = typeof primaryExistingValue === 'object' && primaryExistingValue !== null && (objectKeys.has(key) ||
            !defaultValue$1 || defaultValue$1 === key);
        const primaryIsStaleObject = typeof primaryExistingValue === 'object' && primaryExistingValue !== null && isLeafInNewKeys && !objectKeys.has(key) && !primaryShouldPreserveObject;
        // Special handling for existing objects that should be preserved
        if (shouldPreserveObject) {
            nestedObject.setNestedValue(newTranslations, key, existingValue, separator);
            continue;
        }
        let valueToSet;
        if (existingValue === undefined || isStaleObject) {
            if (locale === primaryLanguage) {
                if (syncPrimaryWithDefaults) {
                    valueToSet =
                        (defaultValue$1 && (!isDerivedDefault || trustDerivedDefaults))
                            ? defaultValue$1
                            : defaultValue.resolveDefaultValue(emptyDefaultValue, key, namespace || config?.extract?.defaultNS || 'translation', locale, defaultValue$1);
                }
                else {
                    // If there's no real code-provided default (defaultValue is derived fallback),
                    // use the configured extract.defaultValue for PRIMARY language too.
                    if (isDerivedDefault && configuredDefaultValue !== undefined) {
                        valueToSet = defaultValue.resolveDefaultValue(configuredDefaultValue, key, namespace || config?.extract?.defaultNS || 'translation', locale, defaultValue$1);
                    }
                    else {
                        valueToSet = defaultValue$1 || key;
                    }
                }
            }
            else {
                // For secondary languages, always use empty string
                valueToSet = defaultValue.resolveDefaultValue(emptyDefaultValue, key, namespace || config?.extract?.defaultNS || 'translation', locale, defaultValue$1);
            }
        }
        else {
            // A key is a synthesized plural variant only when the extractor flagged it
            // with `hasCount` AND its suffix matches a CLDR plural form. Relying purely
            // on the presence of the separator misclassifies regular keys that happen to
            // contain `_` (e.g. `abc_123`) — see issue #250. Context variants are caught
            // by `isDerivedDefault` below (their synthesized default mirrors the base key).
            const isVariantKey = (() => {
                if (!hasCount)
                    return false;
                const parts = key.split(pluralSeparator);
                if (parts.length < 2)
                    return false;
                return pluralForms.includes(parts[parts.length - 1]);
            })();
            // Existing value exists - decide whether to preserve, sync primary, or clear other locales when requested
            if (locale === primaryLanguage && syncPrimaryWithDefaults) {
                // If this key is a plural/context variant and the default wasn't explicitly
                // provided in source code, preserve the existing value.
                if (isVariantKey && !explicitDefault) {
                    valueToSet = existingValue;
                }
                else if (defaultValue$1 && (!isDerivedDefault || trustDerivedDefaults)) {
                    valueToSet = defaultValue.resolveDefaultValue(defaultValue$1, key, namespace || config?.extract?.defaultNS || 'translation', locale, defaultValue$1);
                }
                else {
                    valueToSet = existingValue;
                }
            }
            else {
                // Non-primary locale behavior
                // A plural variant whose category exists in the current locale but not in the
                // primary language (e.g. French `_many` vs English `one`/`other`) will always be
                // absent from the primary file by CLDR design. Treat that absence as expected —
                // not as the primary "diverging" from the default — so --sync-all preserves the
                // locale-specific translation instead of clearing it on every run. (issue #248)
                const isLocaleSpecificPluralVariant = (() => {
                    if (!hasCount)
                        return false;
                    const parts = String(key).split(pluralSeparator);
                    if (parts.length < 2)
                        return false;
                    const lastPart = parts[parts.length - 1];
                    if (isOrdinal && parts.length >= 3 && parts[parts.length - 2] === 'ordinal') {
                        return !primaryOrdinalCategoriesSet.has(lastPart);
                    }
                    return !primaryCardinalCategoriesSet.has(lastPart);
                })();
                const primaryDivergedFromDefault = Boolean(defaultValue$1 &&
                    !primaryShouldPreserveObject &&
                    !isLocaleSpecificPluralVariant &&
                    (primaryExistingValue === undefined ||
                        primaryIsStaleObject ||
                        ((!isVariantKey || explicitDefault) &&
                            primaryExistingValue !== defaultValue.resolveDefaultValue(defaultValue$1, key, namespace || config?.extract?.defaultNS || 'translation', primaryLanguage, defaultValue$1))));
                const syncExplicitDefault = Boolean(syncAll &&
                    locale !== primaryLanguage &&
                    explicitDefault &&
                    primaryDivergedFromDefault);
                const syncDerivedDefault = Boolean(syncAll &&
                    locale !== primaryLanguage &&
                    syncPrimaryWithDefaults &&
                    trustDerivedDefaults &&
                    defaultValue$1 &&
                    isDerivedDefault &&
                    primaryDivergedFromDefault);
                if (syncAll && locale !== primaryLanguage && (syncExplicitDefault || syncDerivedDefault)) {
                    // When syncAll is requested and the primary value has actually diverged from the
                    // code-provided default, clear secondary translations so the new primary default
                    // can be propagated while secondary locales get a blank/placeholder value.
                    valueToSet = defaultValue.resolveDefaultValue(emptyDefaultValue, key, namespace || config?.extract?.defaultNS || 'translation', locale, defaultValue$1);
                }
                else {
                    // Preserve existing translation by default
                    valueToSet = existingValue;
                }
            }
        }
        // Guard against nesting conflicts before writing to the output object.
        // A conflict arises when one extracted key would clobber an ancestor/descendant
        // that was already written by a different extracted key, e.g.:
        //   t("a.b")   => sets a.b = string
        //   t("a.b.c") => tries to descend into a.b which is already a string
        // In that situation we skip the conflicting key and emit a log error so
        // developers see the problem immediately — a skipped key becomes a missing
        // translation at runtime.
        if (separator && typeof separator === 'string') {
            const conflictingPath = findNestingConflict(newTranslations, key, separator);
            if (conflictingPath !== null) {
                logger$1.error(`Error: Nesting conflict: key "${key}" conflicts with existing key "${conflictingPath}". ` +
                    `"${key}" will be skipped — fix the overlapping key paths in your source code to avoid missing translations at runtime.`);
                continue;
            }
        }
        nestedObject.setNestedValue(newTranslations, key, valueToSet, separator);
    }
    // When allPluralForms is enabled, ensure all union plural forms exist for every plural base key.
    // The extractor only generates forms for the configured locales' categories, so we need to fill in the rest.
    if (allLocalesCardinalCategories && !config.extract.disablePlurals) {
        for (const base of expandedBases) {
            for (const form of allLocalesCardinalCategories) {
                const finalKey = `${base}${pluralSeparator}${form}`;
                const separator = finalKey.startsWith('<') ? false : (keySeparator ?? '.');
                const existingInNew = nestedObject.getNestedValue(newTranslations, finalKey, separator);
                if (existingInNew === undefined) {
                    const existingVariantValue = nestedObject.getNestedValue(existingTranslations, finalKey, separator);
                    if (existingVariantValue !== undefined) {
                        nestedObject.setNestedValue(newTranslations, finalKey, existingVariantValue, separator);
                    }
                    else {
                        const resolvedValue = defaultValue.resolveDefaultValue(emptyDefaultValue, String(base), namespace || config?.extract?.defaultNS || 'translation', locale);
                        nestedObject.setNestedValue(newTranslations, finalKey, resolvedValue, separator);
                    }
                }
            }
        }
    }
    // 2a. When sort is disabled but removeUnusedKeys is on, the rebuild from `{}`
    // lost the original key order. Reorder to match existingTranslations, with new keys at the end.
    if (sort === false && removeUnusedKeys) {
        const reorderToMatch = (newObj, refObj) => {
            if (typeof newObj !== 'object' || newObj === null || typeof refObj !== 'object' || refObj === null)
                return newObj;
            const ordered = {};
            // First: keys from refObj in original order
            for (const key of Object.keys(refObj)) {
                if (key in newObj) {
                    ordered[key] = (typeof newObj[key] === 'object' && newObj[key] !== null && typeof refObj[key] === 'object' && refObj[key] !== null)
                        ? reorderToMatch(newObj[key], refObj[key])
                        : newObj[key];
                }
            }
            // Then: new keys not in refObj
            for (const key of Object.keys(newObj)) {
                if (!(key in ordered)) {
                    ordered[key] = newObj[key];
                }
            }
            return ordered;
        };
        return reorderToMatch(newTranslations, existingTranslations);
    }
    // 2b. If sorting is enabled, recursively sort the entire object.
    // This correctly handles both top-level and nested keys.
    if (sort === true) {
        return sortObject(newTranslations, config);
    }
    // 'locize' preset: mirror the key order of locize-published files, which sort
    // flat keys with Array.prototype.sort (UTF-16 code-unit order) before
    // unflattening. Unlike the default sort, this is case-sensitive and applies
    // no canonical plural-form ordering, so extract → locize-sync/-download
    // round-trips without spurious reorder diffs.
    if (sort === 'locize') {
        return sortObjectCodeUnit(newTranslations);
    }
    // Custom sort function logic remains as a future enhancement if needed,
    // but for now, this robustly handles the most common `sort: true` case.
    if (typeof sort === 'function') {
        const sortedObject = {};
        const topLevelKeys = Object.keys(newTranslations);
        // Create a map from key string to ExtractedKey for lookup
        const keyMap = new Map();
        for (const extractedKey of nsKeys) {
            // Store the full key path
            keyMap.set(String(extractedKey.key), extractedKey);
            // For nested keys, also store the top-level part
            if (keySeparator) {
                const topLevelKey = String(extractedKey.key).split(keySeparator)[0];
                if (!keyMap.has(topLevelKey)) {
                    keyMap.set(topLevelKey, extractedKey);
                }
            }
        }
        // Create a string comparator that applies the same logic as the custom sort function
        // by extracting the actual comparison behavior
        const stringSort = (a, b) => {
            // Try to find ExtractedKey objects to use the custom comparator
            const keyA = keyMap.get(a);
            const keyB = keyMap.get(b);
            if (keyA && keyB) {
                return sort(keyA, keyB);
            }
            // If we don't have ExtractedKey objects, we need to apply the same sorting logic
            // Create mock ExtractedKey objects with just the key property
            const mockKeyA = { key: a };
            const mockKeyB = { key: b };
            return sort(mockKeyA, mockKeyB);
        };
        // Sort top-level keys
        topLevelKeys.sort(stringSort);
        // Pass the same string comparator to sortObject for nested keys
        for (const key of topLevelKeys) {
            sortedObject[key] = sortObject(newTranslations[key], config, stringSort);
        }
        newTranslations = sortedObject;
    }
    return newTranslations;
}
/**
 * Moves extracted keys that are already translated in a fallback namespace out
 * of their extracted namespace bucket and into the fallback namespace bucket.
 *
 * Mirrors the i18next runtime lookup order: the requested namespace wins when
 * it has a value for the key, otherwise the fallback namespaces are consulted
 * in order (`fallbackNS` may be a string or an array of strings).
 *
 * Existence is decided against the primary language files on disk:
 * - A key that already has a non-empty value in its own namespace file is an
 *   intentional per-namespace override and stays where it was extracted.
 * - Otherwise, the first fallback namespace containing a non-empty value for
 *   the key claims it. The key is re-bucketed there so `removeUnusedKeys`
 *   treats it as used and preserves it.
 * - Keys found in no fallback namespace are new and stay in their extracted
 *   namespace, matching the i18next `saveMissing` behavior.
 */
async function reattributeFallbackNsKeys(keysByNS, noNsToken, config, primaryLanguage) {
    const rawFallbackNS = config.extract.fallbackNS;
    const fallbackNamespaces = !rawFallbackNS
        ? []
        : (Array.isArray(rawFallbackNS) ? rawFallbackNS : [rawFallbackNS]).filter((ns) => typeof ns === 'string' && ns.length > 0);
    if (fallbackNamespaces.length === 0)
        return;
    const keySeparator = config.extract.keySeparator ?? '.';
    const pluralSeparator = config.extract.pluralSeparator ?? '_';
    // Same merged-output detection as the per-locale loop in getTranslations.
    const shouldMerge = config.extract.mergeNamespaces || (typeof config.extract.output === 'string' ? !config.extract.output.includes('{{namespace}}') : false);
    const mergedPrimaryPath = node_path.resolve(process.cwd(), fileUtils.getOutputPath(config.extract.output, primaryLanguage));
    const mergedPrimaryFile = shouldMerge
        ? (await fileUtils.loadTranslationFile(mergedPrimaryPath) || {})
        : null;
    const catalogCache = new Map();
    const loadPrimaryCatalog = async (ns, isFallback) => {
        const cacheKey = `${isFallback ? 'fb' : 'own'}:${ns}`;
        let catalog = catalogCache.get(cacheKey);
        if (!catalog) {
            if (mergedPrimaryFile) {
                catalog = mergedPrimaryFile[ns];
                if (catalog === undefined) {
                    // The namespace may live in its own file outside the merged one
                    // (split out and hidden via `ignoreNamespaces`, #287). Only
                    // reachable when `output` resolves it to a separate path.
                    const nsPath = node_path.resolve(process.cwd(), fileUtils.getOutputPath(config.extract.output, primaryLanguage, ns));
                    if (nsPath !== mergedPrimaryPath) {
                        catalog = (await fileUtils.loadTranslationFile(nsPath)) ?? undefined;
                    }
                }
                // In merged mode the fallback keys may live at the top level when the
                // file is not namespaced (same resolution as the status command).
                catalog ??= (isFallback ? mergedPrimaryFile : {});
            }
            else {
                catalog = await fileUtils.loadTranslationFile(node_path.resolve(process.cwd(), fileUtils.getOutputPath(config.extract.output, primaryLanguage, ns))) || {};
            }
            catalogCache.set(cacheKey, catalog);
        }
        return catalog;
    };
    // Plural categories of the primary language, used to recognise a base
    // count-key (e.g. "item") through its expanded variants ("item_one", …).
    const primaryCardinalCategories = pluralRules.safePluralRules(primaryLanguage, { type: 'cardinal' }).resolvedOptions().pluralCategories;
    const primaryOrdinalCategories = pluralRules.safePluralRules(primaryLanguage, { type: 'ordinal' }).resolvedOptions().pluralCategories;
    const hasTranslation = (catalog, extractedKey) => {
        const isTranslated = (value) => value !== undefined && value !== null && value !== '';
        if (isTranslated(nestedObject.getNestedValue(catalog, extractedKey.key, keySeparator)))
            return true;
        if (extractedKey.hasCount && !config.extract.disablePlurals && !extractedKey.isExpandedPlural) {
            const categories = extractedKey.isOrdinal ? primaryOrdinalCategories : primaryCardinalCategories;
            return categories.some(category => {
                const variant = extractedKey.isOrdinal
                    ? `${extractedKey.key}${pluralSeparator}ordinal${pluralSeparator}${category}`
                    : `${extractedKey.key}${pluralSeparator}${category}`;
                return isTranslated(nestedObject.getNestedValue(catalog, variant, keySeparator));
            });
        }
        return false;
    };
    for (const [nsKey, nsKeys] of [...keysByNS.entries()]) {
        if (nsKey === noNsToken || fallbackNamespaces.includes(nsKey))
            continue;
        const ownCatalog = await loadPrimaryCatalog(nsKey, false);
        const keptKeys = [];
        for (const extractedKey of nsKeys) {
            // A key with a real value in its own namespace file is an intentional
            // per-namespace override — keep extracting it into that namespace.
            if (hasTranslation(ownCatalog, extractedKey)) {
                keptKeys.push(extractedKey);
                continue;
            }
            let claimedBy;
            for (const fallbackNs of fallbackNamespaces) {
                if (hasTranslation(await loadPrimaryCatalog(fallbackNs, true), extractedKey)) {
                    claimedBy = fallbackNs;
                    break;
                }
            }
            if (claimedBy) {
                if (!keysByNS.has(claimedBy))
                    keysByNS.set(claimedBy, []);
                keysByNS.get(claimedBy).push({ ...extractedKey, ns: claimedBy, nsIsImplicit: false });
            }
            else {
                keptKeys.push(extractedKey);
            }
        }
        if (keptKeys.length !== nsKeys.length) {
            if (keptKeys.length > 0) {
                keysByNS.set(nsKey, keptKeys);
            }
            else {
                // Every key moved to a fallback namespace: drop the bucket so a brand
                // new (empty) namespace file is not created. If the file already
                // exists on disk it is still processed via the on-disk namespace scan
                // and cleaned up by `removeUnusedKeys`.
                keysByNS.delete(nsKey);
            }
        }
    }
}
/**
 * Processes extracted translation keys and generates translation files for all configured locales.
 *
 * This function:
 * 1. Groups keys by namespace
 * 2. For each locale and namespace combination:
 * - Reads existing translation files
 * - Preserves keys matching `preservePatterns` and those from `objectKeys`
 * - Merges in newly extracted keys
 * - Uses primary language defaults or empty strings for secondary languages
 * - Maintains key sorting based on configuration
 * 3. Determines if files need updating by comparing content
 *
 * @param keys - Map of extracted translation keys with metadata.
 * @param objectKeys - A set of base keys that were called with the `returnObjects: true` option.
 * @param config - The i18next toolkit configuration object.
 * @returns Promise resolving to array of translation results with update status.
 *
 * @example
 * ```typescript
 * const keys = new Map([
 * ['translation:welcome', { key: 'welcome', defaultValue: 'Welcome!', ns: 'translation' }],
 * ]);
 * const objectKeys = new Set(['countries']);
 *
 * const results = await getTranslations(keys, objectKeys, config);
 * // Results contain update status and new/existing translations for each locale.
 * ```
 */
async function getTranslations(keys, objectKeys, config, { syncPrimaryWithDefaults = false, syncAll = false, trustDerivedDefaults = false, logger: logger$1 = new logger.ConsoleLogger() } = {}) {
    config.extract.primaryLanguage ||= config.locales[0] || 'en';
    const primaryLanguage = config.extract.primaryLanguage || config.locales[0] || 'en';
    config.extract.secondaryLanguages ||= config.locales.filter((l) => l !== primaryLanguage);
    const patternsToPreserve = [...(config.extract.preservePatterns || [])];
    const indentation = config.extract.indentation ?? 2;
    for (const key of objectKeys) {
        // Object keys are matched directly (and cheaply) against the objectKeys Set in
        // buildNewTranslationsForNs (see isUnderObjectKey). Only a key that itself
        // contains a wildcard still needs the glob-to-regex path.
        if (key.includes('*')) {
            patternsToPreserve.push(`${key}.*`);
        }
    }
    const preservePatterns = patternsToPreserve.map(globToRegex);
    // Group keys by namespace. If the plugin recorded the namespace as implicit
    // (nsIsImplicit) AND the user set defaultNS === false we treat those keys
    // as "no namespace" (will be merged at top-level). Otherwise use the stored
    // namespace (internally we keep implicit keys as 'translation').
    const NO_NS_TOKEN = '__no_namespace__';
    const keysByNS = new Map();
    for (const k of keys.values()) {
        const ns = k.ns;
        const nsKey = (k.nsIsImplicit && config.extract.defaultNS === false)
            ? NO_NS_TOKEN
            : String(ns ?? (config.extract.defaultNS ?? 'translation'));
        if (!keysByNS.has(nsKey))
            keysByNS.set(nsKey, []);
        keysByNS.get(nsKey).push(k);
    }
    // Filter out ignored namespaces
    const ignoreNamespaces = new Set(config.extract.ignoreNamespaces ?? []);
    for (const ns of ignoreNamespaces) {
        keysByNS.delete(ns);
    }
    // Respect fallbackNS (#272): a key extracted for another namespace that is
    // already translated in a fallback namespace resolves at runtime through the
    // fallback chain, so it must not be duplicated into that namespace's file.
    // Re-attribute such keys to the fallback namespace bucket instead — this both
    // suppresses the duplicate and marks the key as "used" in the fallback
    // namespace so `removeUnusedKeys` does not prune it there.
    await reattributeFallbackNsKeys(keysByNS, NO_NS_TOKEN, config, primaryLanguage);
    const results = [];
    const userIgnore = Array.isArray(config.extract.ignore)
        ? config.extract.ignore
        : config.extract.ignore ? [config.extract.ignore] : [];
    // Process each locale one by one
    for (const locale of config.locales) {
        // If output is a string we can detect the presence of the namespace placeholder.
        // If it's a function we cannot reliably detect that here — default to not merged
        // unless mergeNamespaces is explicitly true.
        const shouldMerge = config.extract.mergeNamespaces || (typeof config.extract.output === 'string' ? !config.extract.output.includes('{{namespace}}') : false);
        // LOGIC PATH 1: Merged Namespaces
        if (shouldMerge) {
            const newMergedTranslations = {};
            const outputPath = fileUtils.getOutputPath(config.extract.output, locale);
            const fullPath = node_path.resolve(process.cwd(), outputPath);
            const existingMergedFile = await fileUtils.loadTranslationFile(fullPath) || {};
            const primaryMergedPath = node_path.resolve(process.cwd(), fileUtils.getOutputPath(config.extract.output, primaryLanguage));
            const primaryMergedFile = locale === primaryLanguage
                ? existingMergedFile
                : (await fileUtils.loadTranslationFile(primaryMergedPath) || {});
            // Determine whether the existing merged file already uses namespace objects
            // or is a flat mapping of translation keys -> values.
            // If it's flat (values are primitives), we must NOT treat each translation key as a namespace.
            const existingKeys = Object.keys(existingMergedFile);
            // Treat the file as namespaced only when the user is using namespaces.
            // If defaultNS === false the project stores translations at the top-level
            // (possibly as nested objects when keySeparator is '.'), which should NOT
            // be interpreted as "namespaced files". This avoids splitting a single
            // merged translations file into artificial namespace buckets on re-extract.
            const existingIsNamespaced = (config.extract.defaultNS !== false) && (config.extract.nsSeparator !== false) && existingKeys.some(k => {
                const v = existingMergedFile[k];
                return typeof v === 'object' && v !== null && !Array.isArray(v);
            });
            // The namespaces to process:
            // - If existing file is namespaced, combine keysByNS with existingMergedFile namespaces.
            // - If existing file is flat (top-level translations), ensure NO_NS_TOKEN is processed.
            const namespacesToProcess = existingIsNamespaced
                ? new Set([...keysByNS.keys(), ...existingKeys])
                : new Set([...keysByNS.keys(), NO_NS_TOKEN]);
            // Remove ignored namespaces so their section is never modified
            for (const ns of ignoreNamespaces) {
                namespacesToProcess.delete(ns);
            }
            // When nsSeparator is false, keys resolved to the defaultNS (e.g. from
            // useTranslation() with no args) should be treated as top-level, not
            // wrapped under the namespace name — but only when there are no other
            // explicit namespaces. If multiple namespaces exist, we must keep the
            // default namespace wrapper to avoid flattening it into the top level (#227).
            const defaultNs = String(config.extract.defaultNS ?? 'translation');
            const hasOtherNamespaces = [...keysByNS.keys()].some(k => k !== NO_NS_TOKEN && k !== defaultNs);
            const isTopLevel = (nsKey) => nsKey === NO_NS_TOKEN || (config.extract.nsSeparator === false && nsKey === defaultNs && !hasOtherNamespaces);
            for (const nsKey of namespacesToProcess) {
                const nsKeys = keysByNS.get(nsKey) || [];
                if (isTopLevel(nsKey)) {
                    // keys without namespace -> merged into top-level of the merged file
                    const built = buildNewTranslationsForNs(nsKeys, existingMergedFile, config, locale, undefined, preservePatterns, objectKeys, syncPrimaryWithDefaults, syncAll, trustDerivedDefaults, primaryMergedFile, logger$1);
                    Object.assign(newMergedTranslations, built);
                }
                else {
                    const existingTranslations = existingMergedFile[nsKey] || {};
                    const primaryExistingTranslations = primaryMergedFile[nsKey] || {};
                    newMergedTranslations[nsKey] = buildNewTranslationsForNs(nsKeys, existingTranslations, config, locale, nsKey, preservePatterns, objectKeys, syncPrimaryWithDefaults, syncAll, trustDerivedDefaults, primaryExistingTranslations, logger$1);
                }
            }
            // Preserve ignored namespaces as-is from the existing merged file
            for (const ns of ignoreNamespaces) {
                if (ns in existingMergedFile) {
                    newMergedTranslations[ns] = existingMergedFile[ns];
                }
            }
            const oldContent = JSON.stringify(existingMergedFile, null, indentation);
            const newContent = JSON.stringify(newMergedTranslations, null, indentation);
            // Push a single result for the merged file
            results.push({ path: fullPath, locale, updated: newContent !== oldContent, newTranslations: newMergedTranslations, existingTranslations: existingMergedFile });
            // LOGIC PATH 2: Separate Namespace Files
        }
        else {
            // Find all namespaces that exist on disk for this locale.
            const namespacesToProcess = new Set(keysByNS.keys());
            const existingNsPattern = fileUtils.getOutputPath(config.extract.output, locale, '*');
            // Ensure glob receives POSIX-style separators so pattern matching works cross-platform (Windows -> backslashes)
            const existingNsGlobPattern = existingNsPattern.replace(/\\/g, '/');
            const existingNsFiles = await glob.glob(existingNsGlobPattern, { ignore: userIgnore });
            for (const file of existingNsFiles) {
                const ns = node_path.basename(file, node_path.extname(file));
                if (ns) {
                    namespacesToProcess.add(ns);
                }
            }
            // Remove ignored namespaces so their files are never modified
            for (const ns of ignoreNamespaces) {
                namespacesToProcess.delete(ns);
            }
            // Process each namespace individually and create a result for each one
            for (const ns of namespacesToProcess) {
                const nsKeys = keysByNS.get(ns) || [];
                const outputPath = fileUtils.getOutputPath(config.extract.output, locale, ns);
                const fullPath = node_path.resolve(process.cwd(), outputPath);
                const existingTranslations = await fileUtils.loadTranslationFile(fullPath) || {};
                const primaryOutputPath = node_path.resolve(process.cwd(), fileUtils.getOutputPath(config.extract.output, primaryLanguage, ns));
                const primaryExistingTranslations = locale === primaryLanguage
                    ? existingTranslations
                    : (await fileUtils.loadTranslationFile(primaryOutputPath) || {});
                const newTranslations = buildNewTranslationsForNs(nsKeys, existingTranslations, config, locale, ns, preservePatterns, objectKeys, syncPrimaryWithDefaults, syncAll, trustDerivedDefaults, primaryExistingTranslations, logger$1);
                const oldContent = JSON.stringify(existingTranslations, null, indentation);
                const newContent = JSON.stringify(newTranslations, null, indentation);
                // Push one result per namespace file
                results.push({ path: fullPath, locale, namespace: ns, updated: newContent !== oldContent, newTranslations, existingTranslations });
            }
        }
    }
    return results;
}

exports.getTranslations = getTranslations;
