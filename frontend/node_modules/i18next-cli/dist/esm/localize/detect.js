import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

async function pathExists(path) {
    try {
        await access(path);
        return true;
    }
    catch {
        return false;
    }
}
async function readPackageDeps() {
    try {
        const content = await readFile(join(process.cwd(), 'package.json'), 'utf-8');
        const packageJson = JSON.parse(content);
        return { ...packageJson.dependencies, ...packageJson.devDependencies };
    }
    catch {
        return {};
    }
}
/**
 * Detects the project stack relevant to the `localize` orchestrator:
 * frontend framework, i18next presence, an existing i18n init file,
 * Next.js App Router usage and inlang Paraglide usage.
 *
 * All checks are `process.cwd()`-relative (run from the package directory
 * in monorepos).
 *
 * @param findInitFile - locator for an existing i18n init file
 *                       (injected to reuse the instrumenter's implementation)
 */
async function detectStack(findInitFile) {
    const deps = await readPackageDeps();
    const has = (name) => !!deps[name];
    let framework = 'unknown';
    if (has('next'))
        framework = 'next';
    else if (has('react') || has('react-i18next'))
        framework = 'react';
    else if (has('vue') || has('nuxt'))
        framework = 'vue';
    else if (has('svelte') || has('@sveltejs/kit'))
        framework = 'svelte';
    else if (has('@angular/core'))
        framework = 'angular';
    const cwd = process.cwd();
    const hasAppRouter = framework === 'next' &&
        (await pathExists(join(cwd, 'app')) || await pathExists(join(cwd, 'src', 'app')));
    const hasParaglide = has('@inlang/paraglide-js') || await pathExists(join(cwd, 'project.inlang'));
    return {
        framework,
        hasI18next: has('i18next') || has('react-i18next'),
        hasTypeScript: await pathExists(join(cwd, 'tsconfig.json')),
        initFile: await findInitFile(),
        hasAppRouter,
        hasParaglide,
    };
}
/** File extensions associated with frameworks the instrumenter cannot transform natively. */
const STACK_EXTENSIONS = {
    vue: ['.vue', 'vue'],
    svelte: ['.svelte', 'svelte'],
};
/**
 * Checks whether a configured plugin covers the detected stack's file
 * extension via `instrumentExtensions` or `lintExtensions` — in which case
 * the instrument/extract runners can process the stack's files through the
 * plugin hooks and `localize` runs the full flow.
 */
function hasStackPlugin(config, framework) {
    const extensions = STACK_EXTENSIONS[framework];
    if (!extensions || !config.plugins?.length)
        return false;
    return config.plugins.some((plugin) => {
        const declared = [
            ...(plugin.instrumentExtensions || []),
            ...(plugin.lintExtensions || []),
        ];
        return declared.some(ext => extensions.includes(ext));
    });
}

export { detectStack, hasStackPlugin };
