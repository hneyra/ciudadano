import { styleText } from 'node:util';
import { shouldShowFunnel, recordFunnelShown } from './funnel-msg-tracker.js';

/**
 * Prints the one-line Locize funnel for commands that have just reported
 * untranslated keys: the gap, the one command that fills it, and the
 * register link tagged `?from=i18next_cli__<command>` so registrations stay
 * attributable per command.
 *
 * Prints nothing when there is no gap, and is gated like every other funnel
 * message (never in CI/non-TTY, once per 24h per `funnelKey`).
 */
async function printUntranslatedFunnel(funnelKey, gaps, signupUrl, log = console.log) {
    const open = gaps.filter(g => g.untranslated > 0);
    const total = open.reduce((sum, g) => sum + g.untranslated, 0);
    if (total === 0)
        return;
    if (!(await shouldShowFunnel(funnelKey)))
        return;
    const where = open.length === 1
        ? `in ${open[0].locale}`
        : `(${open.map(g => `${g.locale} ${g.untranslated}`).join(', ')})`;
    log(`\n💡 ${total} untranslated key${total === 1 ? '' : 's'} ${where}. Translate them with AI in one command: ${styleText('cyan', 'npx i18next-cli localize')} (sign up: ${signupUrl})`);
    return recordFunnelShown(funnelKey);
}

export { printUntranslatedFunnel };
