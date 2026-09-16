import type { I18nextToolkitConfig } from './types.js';
/**
 * Error thrown by {@link runLocizeCommand} when `throwOnError` is set,
 * carrying the captured output of the failed locize-cli invocation so
 * orchestrating commands (e.g. `localize`) can inspect and react to it.
 */
export declare class LocizeCommandError extends Error {
    stdout: string;
    stderr: string;
    constructor(message: string, output?: {
        stdout?: string;
        stderr?: string;
    });
}
/**
 * Masks an API key / PAT for safe console output, mirroring Locize's own
 * maskSecret format:
 * - prefixed tokens: `lz_pat_4xK9****************************oZ1i`
 * - legacy UUID keys: first and last 3 characters visible
 */
export declare function maskApiKey(apiKey: string): string;
export declare const runLocizeSync: (config: I18nextToolkitConfig, cliOptions?: any) => Promise<void>;
export declare const runLocizeDownload: (config: I18nextToolkitConfig, cliOptions?: any) => Promise<void>;
export declare const runLocizeMigrate: (config: I18nextToolkitConfig, cliOptions?: any) => Promise<void>;
//# sourceMappingURL=locize.d.ts.map