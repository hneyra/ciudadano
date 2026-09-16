'use strict';

var node_util = require('node:util');
var glob = require('glob');
var promises = require('node:fs/promises');
var node_path = require('node:path');
var wrapOra = require('./utils/wrap-ora.js');
var logger = require('./utils/logger.js');
var defaultValue = require('./utils/default-value.js');
var fileUtils = require('./utils/file-utils.js');
var locizeFunnel = require('./utils/locize-funnel.js');
var nestedObject = require('./utils/nested-object.js');
var pluralRules = require('./utils/plural-rules.js');
var gitChangedKeys = require('./utils/git-changed-keys.js');

const LOCIZE_SIGNUP_URL = 'https://www.locize.app/register?from=i18next_cli__sync';
/**
 * Synchronizes translation files across different locales by ensuring all secondary
 * language files contain the same keys as the primary language file.
 *
 * This function:
 * 1. Reads the primary language translation file
 * 2. Extracts all translation keys from the primary file
 * 3. For each secondary language:
 *    - Preserves existing translations
 *    - Adds missing keys with empty values or configured default
 *    - Removes keys that no longer exist in primary
 * 4. Only writes files that have changes
 *
 * @param config - The i18next toolkit configuration object
 *
 * @example
 * ```typescript
 * // Configuration
 * const config = {
 *   locales: ['en', 'de', 'fr'],
 *   extract: {
 *     output: 'locales/{{language}}/{{namespace}}.json',
 *     defaultNS: 'translation'
 *     defaultValue: '[MISSING]'
 *   }
 * }
 *
 * await runSyncer(config)
 * ```
 */
async function runSyncer(config, options = {}) {
    const internalLogger = options.logger ?? new logger.ConsoleLogger();
    // Resolved before the try/catch below on purpose: an unusable git setup
    // must fail the command (clear message, non-zero exit) instead of being
    // logged and swallowed like a regular sync error.
    const gitCompare = options.changedOnly ? gitChangedKeys.resolveGitCompareRef(options.base) : null;
    const spinner = wrapOra.createSpinnerLike('Running i18next locale synchronizer...\n', { quiet: !!options.quiet, logger: options.logger });
    try {
        const primaryLanguage = config.extract.primaryLanguage || config.locales[0] || 'en';
        const secondaryLanguages = config.locales.filter((l) => l !== primaryLanguage);
        const { output, keySeparator = '.', outputFormat = 'json', indentation = 2, defaultValue: defaultValue$1 = '', } = config.extract;
        const logMessages = [];
        let wasAnythingSynced = false;
        // Keys still empty after the sync, per secondary locale (the funnel line's gap)
        const untranslatedByLocale = {};
        // 1. Find all namespace files for the primary language
        const primaryNsPatternRaw = fileUtils.getOutputPath(output, primaryLanguage, '*');
        // Ensure glob receives POSIX-style separators so pattern matching works cross-platform (Windows -> backslashes)
        const primaryNsPattern = primaryNsPatternRaw.replace(/\\/g, '/');
        const primaryNsFiles = await glob.glob(primaryNsPattern);
        if (primaryNsFiles.length === 0) {
            const noFilesMsg = `No translation files found for primary language "${primaryLanguage}". Nothing to sync.`;
            spinner.warn(noFilesMsg);
            // Always emit the message to the provided logger (if any) so tests / CI can observe it
            if (typeof internalLogger.warn === 'function')
                internalLogger.warn(noFilesMsg);
            else
                console.warn(noFilesMsg);
            return;
        }
        // Filter out ignored namespaces
        const ignoreNamespaces = new Set(config.extract.ignoreNamespaces ?? []);
        // 2. Loop through each primary namespace file
        for (const primaryPath of primaryNsFiles) {
            const ns = node_path.basename(primaryPath).split('.')[0];
            // Skip ignored namespaces
            if (ignoreNamespaces.has(ns))
                continue;
            const primaryTranslations = await fileUtils.loadTranslationFile(primaryPath);
            if (!primaryTranslations) {
                logMessages.push(`  ${node_util.styleText('yellow', '-')} Could not read primary file: ${primaryPath}`);
                continue;
            }
            const primaryKeys = nestedObject.getNestedKeys(primaryTranslations, keySeparator ?? '.');
            const primaryKeySet = new Set(primaryKeys);
            // --changed-only: diff this primary file against its state at the git
            // compare ref. The changed set is scoped to THIS file so the same bare
            // key name in another namespace does not cross-match.
            let isChangedKey = null;
            if (gitCompare) {
                const oldContent = gitChangedKeys.readFileAtRef(gitCompare.compareRef, primaryPath);
                const oldTranslations = oldContent === null ? {} : gitChangedKeys.parseTranslationContent(oldContent, primaryPath);
                const changedKeys = new Set();
                for (const key of primaryKeys) {
                    const newValue = nestedObject.getNestedValue(primaryTranslations, key, keySeparator ?? '.');
                    const oldValue = nestedObject.getNestedValue(oldTranslations, key, keySeparator ?? '.');
                    if (oldValue === undefined || JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                        changedKeys.add(key);
                    }
                }
                isChangedKey = gitChangedKeys.makeChangedKeyMatcher(changedKeys, config.extract.pluralSeparator ?? '_');
            }
            // 3. For each secondary language, sync the current namespace
            for (const lang of secondaryLanguages) {
                const secondaryPath = fileUtils.getOutputPath(output, lang, ns);
                const fullSecondaryPath = node_path.resolve(process.cwd(), secondaryPath);
                const existingSecondaryTranslations = await fileUtils.loadTranslationFile(fullSecondaryPath) || {};
                const newSecondaryTranslations = {};
                // Determine CLDR plural categories for this specific secondary locale so
                // we can recognise locale-specific plural suffixes (e.g. `_many` for fr/es)
                // that are not present in the primary language and must not be discarded.
                const sep = config.extract.pluralSeparator ?? '_';
                const localeCardinalCategories = (() => {
                    try {
                        return new Set(pluralRules.safePluralRules(lang, { type: 'cardinal' }).resolvedOptions().pluralCategories);
                    }
                    catch {
                        return new Set(['one', 'other']);
                    }
                })();
                const localeOrdinalCategories = (() => {
                    try {
                        return new Set(pluralRules.safePluralRules(lang, { type: 'ordinal' }).resolvedOptions().pluralCategories);
                    }
                    catch {
                        return new Set(['one', 'other', 'two', 'few']);
                    }
                })();
                /**
                 * Returns true when `key` is a plural variant that is:
                 *  1. Valid for this locale's CLDR rules (cardinal or ordinal), AND
                 *  2. Derived from a base key that exists in the primary locale.
                 *
                 * This handles both cardinal (`title_many`) and ordinal
                 * (`place_ordinal_few`) suffixes so neither gets erased during sync.
                 */
                const isLocaleSpecificPluralExtension = (key) => {
                    // Cardinal: key ends with `{sep}{category}` and base key is in primary
                    for (const cat of localeCardinalCategories) {
                        const suffix = `${sep}${cat}`;
                        if (key.endsWith(suffix)) {
                            const base = key.slice(0, -suffix.length);
                            // The base itself, or any primary key that starts with `{base}{sep}`,
                            // confirms this is a plural family rooted in the primary locale.
                            if (primaryKeySet.has(base) || primaryKeys.some(pk => pk.startsWith(`${base}${sep}`))) {
                                return true;
                            }
                        }
                    }
                    // Ordinal: key ends with `{sep}ordinal{sep}{category}`
                    for (const cat of localeOrdinalCategories) {
                        const suffix = `${sep}ordinal${sep}${cat}`;
                        if (key.endsWith(suffix)) {
                            const base = key.slice(0, -suffix.length);
                            if (primaryKeySet.has(base) || primaryKeys.some(pk => pk.startsWith(`${base}${sep}`))) {
                                return true;
                            }
                        }
                    }
                    return false;
                };
                // Build newSecondaryTranslations in a single, order-preserving pass so
                // that the syncer and the extractor produce byte-identical files after
                // the first extract run (issue #216).
                //
                // Strategy:
                //  1. Walk every key in the *existing* secondary file in its current
                //     order.  Keep it if it belongs to the primary key set, or if it is
                //     a valid locale-specific plural extension with a non-empty value.
                //     Obsolete keys (neither primary nor a locale extension) are dropped.
                //  2. Append any primary keys that are genuinely new (not present in the
                //     existing secondary file at all) so they get picked up on first sync.
                //
                // This means that once `extract` has written the secondary file in its
                // canonical order, a subsequent `sync` will read that order and reproduce
                // it exactly — the pipeline becomes idempotent.
                const existingSecondaryKeys = nestedObject.getNestedKeys(existingSecondaryTranslations, keySeparator ?? '.');
                const handledKeys = new Set();
                // Pass 1: existing keys in their current order (preserves extract's ordering)
                for (const key of existingSecondaryKeys) {
                    if (primaryKeySet.has(key)) {
                        const primaryValue = nestedObject.getNestedValue(primaryTranslations, key, keySeparator ?? '.');
                        const existingValue = nestedObject.getNestedValue(existingSecondaryTranslations, key, keySeparator ?? '.');
                        const valueToSet = existingValue ?? defaultValue.resolveDefaultValue(defaultValue$1, key, ns, lang, primaryValue);
                        nestedObject.setNestedValue(newSecondaryTranslations, key, valueToSet, keySeparator ?? '.');
                        handledKeys.add(key);
                    }
                    else if (isLocaleSpecificPluralExtension(key)) {
                        const existingValue = nestedObject.getNestedValue(existingSecondaryTranslations, key, keySeparator ?? '.');
                        // Only preserve non-empty values; an empty string was likely a
                        // placeholder left by a previous (buggy) sync run and should not
                        // be perpetuated. Under --changed-only nothing is ever dropped.
                        if ((existingValue !== '' && existingValue != null) || isChangedKey) {
                            nestedObject.setNestedValue(newSecondaryTranslations, key, existingValue, keySeparator ?? '.');
                            handledKeys.add(key);
                        }
                    }
                    else if (isChangedKey) {
                        // --changed-only: removals are out of scope, keep obsolete keys as-is
                        const existingValue = nestedObject.getNestedValue(existingSecondaryTranslations, key, keySeparator ?? '.');
                        nestedObject.setNestedValue(newSecondaryTranslations, key, existingValue, keySeparator ?? '.');
                    }
                    // else: obsolete key — omit it from the output
                }
                // Pass 2: new primary keys not yet in the secondary file
                for (const key of primaryKeys) {
                    if (!handledKeys.has(key)) {
                        // --changed-only: only propagate keys that changed on this branch
                        if (isChangedKey && !isChangedKey(key))
                            continue;
                        const primaryValue = nestedObject.getNestedValue(primaryTranslations, key, keySeparator ?? '.');
                        const valueToSet = defaultValue.resolveDefaultValue(defaultValue$1, key, ns, lang, primaryValue);
                        nestedObject.setNestedValue(newSecondaryTranslations, key, valueToSet, keySeparator ?? '.');
                    }
                }
                untranslatedByLocale[lang] = (untranslatedByLocale[lang] ?? 0) + nestedObject.getNestedKeys(newSecondaryTranslations, keySeparator ?? '.')
                    .filter(key => nestedObject.getNestedValue(newSecondaryTranslations, key, keySeparator ?? '.') === '').length;
                // Use JSON.stringify for a reliable object comparison, regardless of format
                const oldContent = JSON.stringify(existingSecondaryTranslations);
                const newContent = JSON.stringify(newSecondaryTranslations);
                if (newContent !== oldContent) {
                    wasAnythingSynced = true;
                    const perFileFormat = config.extract.outputFormat ?? fileUtils.inferFormatFromPath(fullSecondaryPath, outputFormat);
                    const raw = perFileFormat === 'json5' ? (await fileUtils.loadRawJson5Content(fullSecondaryPath)) ?? undefined : undefined;
                    const serializedContent = fileUtils.serializeTranslationFile(newSecondaryTranslations, perFileFormat, indentation, raw);
                    await promises.mkdir(node_path.dirname(fullSecondaryPath), { recursive: true });
                    await promises.writeFile(fullSecondaryPath, serializedContent);
                    logMessages.push(`  ${node_util.styleText('green', '✓')} Synchronized: ${secondaryPath}`);
                }
                else {
                    logMessages.push(`  ${node_util.styleText('gray', '-')} Already in sync: ${secondaryPath}`);
                }
            }
        }
        spinner.succeed(node_util.styleText('bold', 'Synchronization complete!'));
        logMessages.forEach(msg => internalLogger.info ? internalLogger.info(msg) : console.log(msg));
        if (wasAnythingSynced && !options.quiet) {
            const gaps = Object.entries(untranslatedByLocale).map(([locale, untranslated]) => ({ locale, untranslated }));
            await locizeFunnel.printUntranslatedFunnel('syncer', gaps, LOCIZE_SIGNUP_URL);
        }
        else if (!wasAnythingSynced) {
            if (typeof internalLogger.info === 'function')
                internalLogger.info(node_util.styleText(['green', 'bold'], '\n✅ All locales are already in sync.'));
            else
                console.log(node_util.styleText(['green', 'bold'], '\n✅ All locales are already in sync.'));
        }
    }
    catch (error) {
        spinner.fail(node_util.styleText('red', 'Synchronization failed.'));
        if (typeof internalLogger.error === 'function')
            internalLogger.error(error);
        else
            console.error(error);
    }
}

exports.runSyncer = runSyncer;
