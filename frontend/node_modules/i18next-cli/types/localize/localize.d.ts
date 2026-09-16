export interface LocalizeOptions {
    dryRun?: boolean;
    yes?: boolean;
    ci?: boolean;
    skipInstrument?: boolean;
    skipTranslate?: boolean;
    skipLocize?: boolean;
    namespace?: string;
    updateValues?: boolean;
    cdnType?: 'standard' | 'pro';
    printAgentPrompt?: boolean;
}
/**
 * The `localize` supercommand: takes a mono-lingual app to fully localized +
 * delivered via Locize in one command, orchestrating the existing pieces —
 * detect → instrument → extract → connect Locize → sync with AI
 * auto-translate → download & verify.
 */
export declare function runLocalize(options?: LocalizeOptions, configPath?: string): Promise<void>;
//# sourceMappingURL=localize.d.ts.map