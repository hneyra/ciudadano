/** Untranslated-key count for one secondary locale. */
export interface LocaleGap {
    locale: string;
    untranslated: number;
}
/**
 * Prints the one-line Locize funnel for commands that have just reported
 * untranslated keys: the gap, the one command that fills it, and the
 * register link tagged `?from=i18next_cli__<command>` so registrations stay
 * attributable per command.
 *
 * Prints nothing when there is no gap, and is gated like every other funnel
 * message (never in CI/non-TTY, once per 24h per `funnelKey`).
 */
export declare function printUntranslatedFunnel(funnelKey: string, gaps: LocaleGap[], signupUrl: string, log?: (msg: string) => void): Promise<void>;
//# sourceMappingURL=locize-funnel.d.ts.map