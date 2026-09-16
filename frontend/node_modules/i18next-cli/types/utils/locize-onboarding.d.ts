/** Rough 8-4-4-4-12 hex UUID shape — not strict (locize project IDs may evolve). */
export declare const UUID_SHAPE: RegExp;
/**
 * Opens the given URL in the user's default browser using the platform-native command.
 * Returns true on success, false if there's nowhere to open one (CI, headless Linux)
 * or if spawning the command failed.
 */
export declare function openBrowser(url: string, opts?: {
    ci?: boolean;
}): Promise<boolean>;
/**
 * Prompts for Locize credentials (Project ID + optional API key) and returns them.
 * Warns (but does not block) when the Project ID does not look like a UUID.
 */
export declare function promptLocizeCredentials(): Promise<{
    projectId: string;
    apiKey?: string;
}>;
//# sourceMappingURL=locize-onboarding.d.ts.map