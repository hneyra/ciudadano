import type { JSXElement } from '@swc/core';
import type { PluginContext, I18nextToolkitConfig } from '../../types.js';
import { ExpressionResolver } from './expression-resolver.js';
export declare class JSXHandler {
    private config;
    private pluginContext;
    private expressionResolver;
    private getCurrentFile;
    private getCurrentCode;
    constructor(config: Omit<I18nextToolkitConfig, 'plugins'>, pluginContext: PluginContext, expressionResolver: ExpressionResolver, getCurrentFile: () => string, getCurrentCode: () => string);
    /**
     * Computes line and column from a node's normalised span.
     * SWC spans are normalised to file-relative offsets after parsing,
     * so we can use them directly.
     */
    private getLocationFromNode;
    /**
     * Emits an error for `<Trans>` children that the serializer cannot turn
     * into the string react-i18next builds at runtime:
     *
     * - `{name}` (a bare identifier): react-i18next inlines the value, but the
     *   extractor serialises the identifier name as `{{name}}`.
     * - `{table.name}`, `{fn()}`, `` {`a ${b}`} `` and any other expression
     *   (the fallback in `swcExpressionToReactNode`): react-i18next inlines the
     *   value, but the extractor emits an empty `<1></1>` placeholder.
     *
     * Either way the extracted key never matches the runtime key. The fix is
     * the `{{name}}` / `{{name: table.name}}` object form, which both sides
     * serialise as `{{name}}`; react-i18next reads the value from that object
     * child, so no `values` prop is needed.
     *
     * We keep the existing extraction behaviour so projects that already rely
     * on the `{{name}}` output (with a matching `values` prop) aren't broken,
     * and instead surface a diagnostic pointing users at the runtime mismatch.
     * Emitted via `logger.error` with an `Error:` prefix so build tooling that
     * watches for errors (see #200) can treat this as fatal if desired.
     */
    private warnOnUnrepresentableTransChildren;
    /**
     * Unwraps TS type-assertion and parenthesis wrappers so we can inspect the
     * underlying expression type (mirrors behaviour in jsx-parser).
     */
    private unwrapExpression;
    /**
     * Processes JSX elements to extract translation keys from Trans components.
     *
     * Identifies configured Trans components and delegates to the JSX parser
     * for complex children serialization and attribute extraction.
     *
     * @param node - JSX element node to process
     * @param getScopeInfo - Function to retrieve scope information for variables
     */
    handleJSXElement(node: JSXElement, getScopeInfo: (name: string) => {
        defaultNs?: string;
        keyPrefix?: string;
    } | undefined): void;
    /**
     * Generates plural keys for Trans components, with support for tOptions plural defaults.
     *
     * @param key - Base key name for pluralization
     * @param defaultValue - Default value for the keys
     * @param ns - Namespace for the keys
     * @param isOrdinal - Whether to generate ordinal plural forms
     * @param optionsNode - Optional tOptions object expression for plural-specific defaults
     * @param explicitDefaultFromSource - Whether the default was explicitly provided
     * @param locations - Source location information for this key
     * @param keyAcceptingContext - The base key that accepts context (if this is a context variant)
     */
    private generatePluralKeysForTrans;
    /**
     * Extracts element name from JSX opening tag.
     *
     * Handles both simple identifiers and member expressions:
     * - `<Trans>` → 'Trans'
     * - `<React.Trans>` → 'React.Trans'
     *
     * @param node - JSX element node
     * @returns Element name or undefined if not extractable
     */
    private getElementName;
}
//# sourceMappingURL=jsx-handler.d.ts.map