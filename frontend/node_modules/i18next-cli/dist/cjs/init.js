'use strict';

var inquirer = require('inquirer');
var promises = require('node:fs/promises');
var node_path = require('node:path');
var heuristicConfig = require('./heuristic-config.js');
var locizeOnboarding = require('./utils/locize-onboarding.js');
var inlangScaffold = require('./utils/inlang-scaffold.js');
var agentNote = require('./utils/agent-note.js');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var inquirer__default = /*#__PURE__*/_interopDefault(inquirer);

const LOCIZE_SIGNUP_URL = 'https://www.locize.app/register?from=i18next_cli__init-wizard';
/**
 * Determines if the current project is configured as an ESM project.
 * Checks the package.json file for `"type": "module"`.
 *
 * @returns Promise resolving to true if ESM, false if CommonJS
 *
 * @example
 * ```typescript
 * const isESM = await isEsmProject()
 * if (isESM) {
 *   // Generate ESM syntax
 * } else {
 *   // Generate CommonJS syntax
 * }
 * ```
 */
async function isEsmProject() {
    try {
        const packageJsonPath = node_path.resolve(process.cwd(), 'package.json');
        const content = await promises.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(content);
        return packageJson.type === 'module';
    }
    catch {
        return true; // Default to ESM if package.json is not found or readable
    }
}
/**
 * Checks whether i18next-cli is listed as a local dependency of the current project.
 * When running via `npx` without a local install, `defineConfig` would not be available
 * at runtime, so the generated config should fall back to a plain object export.
 *
 * @returns Promise resolving to true if i18next-cli is in dependencies or devDependencies
 */
async function isCliLocallyInstalled() {
    try {
        const packageJsonPath = node_path.resolve(process.cwd(), 'package.json');
        const content = await promises.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(content);
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        return !!deps['i18next-cli'];
    }
    catch {
        return false;
    }
}
/**
 * Checks whether the project uses TypeScript by looking for a tsconfig.json.
 *
 * @returns Promise resolving to true if tsconfig.json exists in the project root
 */
async function isTypeScriptProject() {
    try {
        await promises.readFile(node_path.resolve(process.cwd(), 'tsconfig.json'));
        return true;
    }
    catch {
        return false;
    }
}
async function runInit(options = {}) {
    console.log('Welcome to the i18next-cli setup wizard!');
    console.log('Scanning your project for a recommended configuration...');
    const detectedConfig = await heuristicConfig.detectConfig();
    if (detectedConfig) {
        console.log('✅ Found a potential project structure. Using it for suggestions.');
    }
    else {
        console.log('Could not detect a project structure. Using standard defaults.');
    }
    if (typeof detectedConfig?.extract?.input === 'string')
        detectedConfig.extract.input = [detectedConfig?.extract?.input];
    // If heuristic detection returned a function for extract.output, don't use it as a prompt default.
    // Prompt defaults must be strings; leave undefined so the prompt falls back to a sensible default.
    if (detectedConfig && typeof detectedConfig.extract?.output === 'function') {
        delete detectedConfig.extract.output;
    }
    // Detect whether the project uses TypeScript to set the preferred default
    const projectUsesTs = await isTypeScriptProject();
    const tsChoice = 'TypeScript (i18next.config.ts)';
    const jsChoice = 'JavaScript (i18next.config.js)';
    const fileTypeChoices = projectUsesTs ? [tsChoice, jsChoice] : [jsChoice, tsChoice];
    const questions = [
        {
            type: 'select',
            name: 'fileType',
            message: 'What kind of configuration file do you want?',
            choices: fileTypeChoices,
        },
        {
            type: 'input',
            name: 'locales',
            message: 'What locales does your project support? (comma-separated)',
            default: detectedConfig?.locales?.join(',') || 'en,de,fr',
            filter: (input) => input.split(',').map(s => s.trim()),
        },
        {
            type: 'input',
            name: 'input',
            message: 'What is the glob pattern for your source files?',
            default: detectedConfig?.extract?.input ? (detectedConfig.extract.input || [])[0] : 'src/**/*.{js,jsx,ts,tsx}',
        },
        {
            type: 'input',
            name: 'output',
            message: 'What is the path for your output resource files?',
            // ensure the default is a string (detectedConfig.extract.output may be a function)
            default: typeof detectedConfig?.extract?.output === 'string'
                ? detectedConfig.extract.output
                : 'public/locales/{{language}}/{{namespace}}.json',
        },
        {
            type: 'select',
            name: 'backend',
            message: 'Translation backend?',
            choices: [
                { name: 'Local files only', value: 'local' },
                { name: 'Locize (recommended) — managed backend, CDN delivery, optional AI auto-translate', value: 'locize' },
                { name: 'Other / skip', value: 'other' },
            ],
            default: 'local',
        },
        {
            type: 'confirm',
            name: 'inlang',
            message: 'Also set up inlang tooling (Sherlock VS Code extension, Fink editor, Paraglide) on these translation files?',
            default: false,
            // Skip the question when already requested via the --inlang flag.
            when: () => !options.inlang,
        },
        {
            type: 'confirm',
            name: 'agentNote',
            message: 'Add a short note about this i18n setup for AI coding agents to AGENTS.md (and CLAUDE.md if present)? You can edit or delete it at any time.',
            default: false,
        },
    ];
    // Answers given as command-line options skip their question.
    const given = {};
    if (options.fileType)
        given.fileType = options.fileType === 'js' ? jsChoice : tsChoice;
    if (options.locales)
        given.locales = options.locales.split(',').map(s => s.trim()).filter(Boolean);
    if (options.input)
        given.input = options.input;
    if (options.output)
        given.output = options.output;
    if (options.backend)
        given.backend = options.backend;
    if (options.agentNote !== undefined)
        given.agentNote = options.agentNote;
    const remaining = questions.filter(q => !(q.name in given));
    const nonInteractive = !!options.yes;
    let answers;
    if (nonInteractive) {
        // --yes: the detected defaults stand in for every unanswered question; nothing is asked.
        const defaults = {};
        for (const q of remaining) {
            const value = q.default ?? (q.type === 'select' ? (typeof q.choices[0] === 'string' ? q.choices[0] : q.choices[0].value) : undefined);
            defaults[q.name] = q.filter ? q.filter(value) : value;
        }
        answers = { ...defaults, ...given };
    }
    else {
        answers = { ...given, ...(remaining.length > 0 ? await inquirer__default.default.prompt(remaining) : {}) };
    }
    let locizeConfig;
    const knownProjectId = options.projectId || process.env.LOCIZE_PROJECTID || process.env.LOCIZE_PID;
    if (answers.backend === 'locize' && (nonInteractive || knownProjectId)) {
        // No signup page and no prompts: the project id comes from --project-id or the environment
        // (the same variables the locize commands read); the API key stays in LOCIZE_API_KEY.
        if (knownProjectId) {
            locizeConfig = { projectId: knownProjectId };
        }
        else {
            console.log(`\nNo project id given (--project-id or LOCIZE_PROJECTID), so no locize block was written. Create a project at ${LOCIZE_SIGNUP_URL}, then re-run with --project-id <id> (and LOCIZE_API_KEY set), or add locize.projectId to the config by hand.`);
        }
    }
    else if (answers.backend === 'locize') {
        console.log('\nOpening the Locize signup page in your browser. After you create your account and project, come back here and paste your Project ID and API key.');
        const opened = await locizeOnboarding.openBrowser(LOCIZE_SIGNUP_URL, { ci: options.ci });
        if (!opened) {
            console.log(`\n👉 Open this URL manually: ${LOCIZE_SIGNUP_URL}\n`);
        }
        locizeConfig = await locizeOnboarding.promptLocizeCredentials();
    }
    const isTypeScript = answers.fileType.includes('TypeScript');
    const isEsm = await isEsmProject();
    const fileName = isTypeScript ? 'i18next.config.ts' : 'i18next.config.js';
    const configObject = {
        locales: answers.locales,
        extract: {
            input: answers.input,
            output: answers.output,
        },
    };
    if (locizeConfig)
        configObject.locize = locizeConfig;
    // Helper to serialize a JS value as a JS literal:
    function toJs(value, indent = 2, level = 0) {
        const pad = (n) => ' '.repeat(n * indent);
        const currentPad = pad(level);
        const nextPad = pad(level + 1);
        if (value === null || typeof value === 'number' || typeof value === 'boolean') {
            return JSON.stringify(value);
        }
        if (typeof value === 'string') {
            return JSON.stringify(value); // keeps double quotes and proper escaping
        }
        if (Array.isArray(value)) {
            if (value.length === 0)
                return '[]';
            const items = value.map(v => `${nextPad}${toJs(v, indent, level + 1)}`).join(',\n');
            return `[\n${items}\n${currentPad}]`;
        }
        if (typeof value === 'object') {
            const keys = Object.keys(value);
            if (keys.length === 0)
                return '{}';
            const entries = keys.map(key => {
                // Use unquoted key if it's a valid identifier otherwise JSON.stringify(key)
                const validId = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
                const printedKey = validId ? key : JSON.stringify(key);
                return `${nextPad}${printedKey}: ${toJs(value[key], indent, level + 1)}`;
            }).join(',\n');
            return `{\n${entries}\n${currentPad}}`;
        }
        // Fallback
        return JSON.stringify(value);
    }
    const isLocallyInstalled = await isCliLocallyInstalled();
    let fileContent = '';
    if (isLocallyInstalled) {
        // i18next-cli is a local dependency — use defineConfig for type-safety
        if (isTypeScript) {
            fileContent = `import { defineConfig } from 'i18next-cli'

export default defineConfig(${toJs(configObject)})`;
        }
        else if (isEsm) {
            fileContent = `import { defineConfig } from 'i18next-cli'

/** @type {import('i18next-cli').I18nextToolkitConfig} */
export default defineConfig(${toJs(configObject)})`;
        }
        else { // CJS
            fileContent = `const { defineConfig } = require('i18next-cli')

/** @type {import('i18next-cli').I18nextToolkitConfig} */
module.exports = defineConfig(${toJs(configObject)})`;
        }
    }
    else {
        // i18next-cli is not locally installed (e.g. npx) — plain config object
        if (isTypeScript) {
            fileContent = `export default ${toJs(configObject)}`;
        }
        else if (isEsm) {
            fileContent = `/** @type {import('i18next-cli').I18nextToolkitConfig} */
export default ${toJs(configObject)}`;
        }
        else { // CJS
            fileContent = `/** @type {import('i18next-cli').I18nextToolkitConfig} */
module.exports = ${toJs(configObject)}`;
        }
    }
    const outputPath = node_path.resolve(process.cwd(), fileName);
    await promises.writeFile(outputPath, fileContent.trim());
    console.log(`✅ Configuration file created at: ${outputPath}`);
    if (options.inlang || answers.inlang) {
        await inlangScaffold.scaffoldInlangProject({
            locales: answers.locales,
            primaryLanguage: answers.locales[0],
            output: answers.output,
        });
    }
    if (answers.agentNote) {
        const note = agentNote.buildAgentNote({ locales: answers.locales, output: answers.output, backend: answers.backend, locizeProjectId: locizeConfig?.projectId });
        const written = await agentNote.writeAgentNote(note);
        if (written.length > 0) {
            console.log(`📝 Agent note written to: ${written.join(', ')}`);
        }
        else {
            console.log('Agent note already present (heading "## Internationalization" found); nothing written.');
        }
    }
    if (locizeConfig) {
        console.log('\nNext steps for Locize:');
        console.log('  1. Push your local translations to Locize:');
        console.log('       npx i18next-cli locize-sync');
        console.log('  2. Find your Project ID and API keys in the Locize UI under:');
        console.log('       Project Settings → "API, CDN, NOTIFICATIONS" tab (www.locize.app)');
        if (locizeConfig.apiKey) {
            console.log('  3. Before committing, move the API key out of the config file into an environment variable:');
            console.log('       # .env (add to .gitignore)');
            console.log('       LOCIZE_API_KEY=<paste the key currently in your config>');
            console.log('       # then in your config:');
            console.log('       apiKey: process.env.LOCIZE_API_KEY');
        }
        else {
            console.log('  3. Add your API key later via environment variable:');
            console.log('       # .env (add to .gitignore)');
            console.log('       LOCIZE_API_KEY=...');
            console.log('       # then in your config:');
            console.log('       apiKey: process.env.LOCIZE_API_KEY');
        }
        console.log('  4. To enable automatic translation, turn it on in your Locize project settings → "EDITOR, TM/MT/AI, ORDERING" tab (web UI).');
    }
}

exports.runInit = runInit;
