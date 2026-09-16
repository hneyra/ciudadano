'use strict';

var logger = require('./utils/logger.js');
var i18nextResourcesForTs = require('i18next-resources-for-ts');
var glob = require('glob');
var wrapOra = require('./utils/wrap-ora.js');
var node_util = require('node:util');
var promises = require('node:fs/promises');
var node_path = require('node:path');
var core = require('@swc/core');
var fileUtils = require('./utils/file-utils.js');
var json5Parser = require('@croct/json5-parser');
var yaml = require('yaml');
var vm = require('node:vm');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var yaml__default = /*#__PURE__*/_interopDefault(yaml);
var vm__default = /*#__PURE__*/_interopDefault(vm);

async function loadFile(file) {
    const ext = node_path.extname(file);
    if (['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'].includes(ext)) {
        const content = await promises.readFile(file, 'utf-8');
        const { code } = await core.transform(content, {
            filename: file,
            jsc: {
                parser: {
                    syntax: 'typescript',
                },
                target: 'es2018'
            },
            module: {
                type: 'commonjs'
            }
        });
        const exports = {};
        const module = { exports };
        const context = vm__default.default.createContext({
            exports,
            module,
            require: (id) => require(id),
            console,
            process
        });
        const script = new vm__default.default.Script(code, { filename: file });
        script.runInContext(context);
        // @ts-ignore
        const exported = context.module.exports?.default || context.module.exports;
        return exported;
    }
    const content = await promises.readFile(file, 'utf-8');
    if (ext === '.yaml' || ext === '.yml') {
        return yaml__default.default.parse(content);
    }
    if (ext === '.json5') {
        return json5Parser.JsonParser.parse(content, json5Parser.JsonObjectNode).toJSON();
    }
    return JSON.parse(content);
}
/**
 * Extracts namespace from file path relative to base path.
 * Preserves directory structure as namespace using forward slashes.
 *
 * @example
 * getNamespaceFromPath('public/locales/en/dashboard/user.json', 'public/locales/en')
 * // Returns: 'dashboard/user'
 */
function getNamespaceFromPath(filePath, basePath) {
    let relativePath = node_path.relative(basePath, filePath);
    relativePath = relativePath.replace(node_path.extname(relativePath), '');
    return relativePath.replace(/\\/g, '/');
}
/**
 * Generates TypeScript type definitions for i18next translations.
 *
 * This function:
 * 1. Reads translation files based on the input glob patterns
 * 2. Generates TypeScript interfaces using i18next-resources-for-ts
 * 3. Creates separate resources.d.ts and main i18next.d.ts files
 * 4. Handles namespace detection from filenames. Supports nested namespaces when `basePath` is provided
 * 5. Supports type-safe selector API when enabled
 *
 * @param config - The i18next toolkit configuration object
 *
 * @example
 * ```typescript
 * // Configuration
 * const config = {
 *   types: {
 *     input: ['locales/en/*.json'],
 *     output: 'src/types/i18next.d.ts',
 *     enableSelector: true
 *   }
 * }
 *
 * await runTypesGenerator(config)
 * ```
 */
async function runTypesGenerator(config, options = {}) {
    const internalLogger = options.logger ?? new logger.ConsoleLogger();
    const spinner = wrapOra.createSpinnerLike('Generating TypeScript types for translations...\n', { quiet: !!options.quiet || !!options.checkOnly, logger: options.logger });
    try {
        config.extract.primaryLanguage ||= config.locales[0] || 'en';
        let defaultTypesInputPath = config.extract.output || `locales/${config.extract.primaryLanguage}/*.json`;
        defaultTypesInputPath = fileUtils.getOutputPath(defaultTypesInputPath, config.extract.primaryLanguage || 'en', '*');
        if (!config.types)
            config.types = { input: defaultTypesInputPath, output: 'src/@types/i18next.d.ts' };
        if (config.types.input === undefined)
            config.types.input = defaultTypesInputPath;
        if (!config.types.output)
            config.types.output = 'src/@types/i18next.d.ts';
        if (!config.types.resourcesFile)
            config.types.resourcesFile = node_path.join(node_path.dirname(config.types?.output), 'resources.d.ts');
        if (!config.types?.input || config.types?.input.length < 0) {
            console.log('No input defined!');
            return { changed: false, changedFiles: [] };
        }
        const resourceFiles = await glob.glob(config.types.input, { cwd: process.cwd() });
        const basePath = config.types.basePath ? fileUtils.getOutputPath(config.types.basePath, config.extract.primaryLanguage) : undefined;
        const resources = [];
        for (const file of resourceFiles) {
            const namespace = basePath
                ? getNamespaceFromPath(file, basePath)
                : node_path.basename(file, node_path.extname(file));
            if (basePath && namespace.startsWith('..')) {
                internalLogger.warn(node_util.styleText('yellow', `Warning: The file ${file} is outside the configured types.basePath (${basePath}). The resolved namespace "${namespace}" looks incorrect. Please ensure types.basePath is a parent directory of your translation files.`));
            }
            const parsedContent = await loadFile(file);
            // If mergeNamespaces is used, a single file can contain multiple namespaces
            // (e.g. { "translation": { ... }, "common": { ... } } in a per-language file).
            // In that case, expose each top-level key as a namespace entry so the type
            // generator will produce top-level namespace interfaces (not a language wrapper).
            if (config.extract?.mergeNamespaces && parsedContent && typeof parsedContent === 'object') {
                const keys = Object.keys(parsedContent);
                const objectKeys = keys.filter(k => parsedContent[k] && typeof parsedContent[k] === 'object');
                // If we have at least one object and we are in mergeNamespaces mode, assume it's a merged file
                if (objectKeys.length > 0) {
                    for (const nsName of objectKeys) {
                        resources.push({ name: nsName, resources: parsedContent[nsName] });
                    }
                    const nonObjectKeys = keys.filter(k => !parsedContent[k] || typeof parsedContent[k] !== 'object');
                    if (nonObjectKeys.length > 0) {
                        internalLogger.warn(node_util.styleText('yellow', `Warning: The file ${file} contains top-level keys that are not objects (${nonObjectKeys.join(', ')}). When 'mergeNamespaces' is enabled, top-level keys are treated as namespaces. These keys will be ignored.`));
                    }
                    continue;
                }
            }
            resources.push({ name: namespace, resources: parsedContent });
        }
        const logMessages = [];
        const enableSelector = config.types?.enableSelector || false;
        const indentation = config.types?.indentation ?? config.extract.indentation ?? 2;
        const interfaceDefinition = `// This file is automatically generated by i18next-cli. Do not edit manually.
${i18nextResourcesForTs.mergeResourcesAsInterface(resources, { optimize: !!enableSelector, indentation })}`;
        const outputPath = node_path.resolve(process.cwd(), config.types?.output || '');
        const resourcesOutputPath = node_path.resolve(process.cwd(), config.types.resourcesFile);
        if (options.checkOnly) {
            const changedFiles = [];
            let existingResources = null;
            try {
                existingResources = await promises.readFile(resourcesOutputPath, 'utf-8');
            }
            catch {
                existingResources = null;
            }
            if (existingResources !== interfaceDefinition) {
                changedFiles.push(config.types.resourcesFile);
            }
            try {
                await promises.access(outputPath);
            }
            catch {
                changedFiles.push(config.types.output || '');
            }
            return { changed: changedFiles.length > 0, changedFiles };
        }
        await promises.mkdir(node_path.dirname(resourcesOutputPath), { recursive: true });
        await promises.writeFile(resourcesOutputPath, interfaceDefinition);
        logMessages.push(`  ${node_util.styleText('green', '✓')} Resources interface written to ${config.types.resourcesFile}`);
        let outputPathExists;
        try {
            await promises.access(outputPath);
            outputPathExists = true;
        }
        catch (e) {
            outputPathExists = false;
        }
        if (!outputPathExists) {
            // The main output file will now import from the resources file
            const importPath = node_path.relative(node_path.dirname(outputPath), resourcesOutputPath)
                .replace(/\\/g, '/').replace(/\.d\.ts$/, ''); // Make it a valid module path
            // i18next's type system cannot resolve keys for `defaultNS: false` —
            // `t()` would silently accept any string. When `extract.defaultNS` is
            // disabled, derive the default namespace from the generated resources
            // instead, so the generated types stay self-consistent.
            let defaultNS = `'${config.extract.defaultNS || 'translation'}'`;
            if (config.extract.defaultNS === false) {
                const sortedNamespaces = [...new Set(resources.map(r => r.name))].sort();
                // Namespaces resolved outside types.basePath already warn above; rank
                // them last so a valid sibling wins the pick, but keep them derivable —
                // they are real keys of the generated Resources interface.
                const resourceNamespaces = [
                    ...sortedNamespaces.filter(ns => !ns.startsWith('..')),
                    ...sortedNamespaces.filter(ns => ns.startsWith('..')),
                ];
                // Files named after locales (e.g. locales/en.json) carry no namespace
                // information. A single one is still a usable default, but multiple
                // would turn sibling languages into namespaces — keep `false` then.
                // A single locale-named sibling is enough to tell the layout apart:
                // types.input may well match more languages than `locales` lists.
                const onlyLocaleNames = resourceNamespaces.length > 1 && resourceNamespaces.some(ns => config.locales.includes(ns));
                if (resourceNamespaces.length === 0) {
                    defaultNS = 'false';
                }
                else if (onlyLocaleNames) {
                    internalLogger.warn(node_util.styleText('yellow', 'Warning: extract.defaultNS is disabled and your resource files are named after locales, so no namespace could be derived for the generated definitions — defaultNS stays false and t() will not be type-checked. Consider adjusting types.input or types.basePath.'));
                    defaultNS = 'false';
                }
                else {
                    // Unprefixed keys resolve against a single default namespace, so a
                    // single name is emitted; prefer the conventional 'translation'.
                    const effectiveDefault = resourceNamespaces.includes('translation') ? 'translation' : resourceNamespaces[0];
                    internalLogger.warn(node_util.styleText('yellow', `Warning: extract.defaultNS is disabled, so defaultNS was derived from your resource files ('${effectiveDefault}'). Adjust the generated definitions if your runtime i18next config uses a different default namespace.`));
                    defaultNS = `'${effectiveDefault}'`;
                }
            }
            const fallbackNS = config.extract.fallbackNS === false
                ? 'false'
                : Array.isArray(config.extract.fallbackNS)
                    ? `[${config.extract.fallbackNS.map(ns => `'${ns}'`).join(', ')}]`
                    : `'${config.extract.fallbackNS}'`;
            const fileContent = `// This file is automatically generated by i18next-cli, because it was not existing. You can edit it based on your needs: https://www.i18next.com/overview/typescript#custom-type-options
import type Resources from './${importPath}';

declare module 'i18next' {
  interface CustomTypeOptions {
    enableSelector: ${typeof enableSelector === 'string' ? `"${enableSelector}"` : enableSelector};
    defaultNS: ${defaultNS};${config.extract.fallbackNS ? `\n    fallbackNS: ${fallbackNS};` : ''}
    resources: Resources;
  }
}`;
            await promises.mkdir(node_path.dirname(outputPath), { recursive: true });
            await promises.writeFile(outputPath, fileContent);
            logMessages.push(`  ${node_util.styleText('green', '✓')} TypeScript definitions written to ${config.types.output || ''}`);
        }
        spinner.succeed(node_util.styleText('bold', 'TypeScript definitions generated successfully.'));
        logMessages.forEach(msg => typeof internalLogger.info === 'function' ? internalLogger.info(msg) : console.log(msg));
        return { changed: false, changedFiles: [] };
    }
    catch (error) {
        spinner.fail(node_util.styleText('red', 'Failed to generate TypeScript definitions.'));
        if (typeof internalLogger.error === 'function')
            internalLogger.error(error);
        else
            console.error(error);
        return { changed: false, changedFiles: [] };
    }
}

exports.runTypesGenerator = runTypesGenerator;
