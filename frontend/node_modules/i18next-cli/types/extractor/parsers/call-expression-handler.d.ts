import type { CallExpression } from '@swc/core';
import type { PluginContext, I18nextToolkitConfig, Logger, ScopeInfo } from '../../types.js';
import { ExpressionResolver } from './expression-resolver.js';
export declare class CallExpressionHandler {
    private pluginContext;
    private config;
    private logger;
    private expressionResolver;
    objectKeys: Set<string>;
    private getCurrentFile;
    private getCurrentCode;
    private resolveIdentifier;
    constructor(config: Omit<I18nextToolkitConfig, 'plugins'>, pluginContext: PluginContext, logger: Logger, expressionResolver: ExpressionResolver, getCurrentFile: () => string, getCurrentCode: () => string, resolveIdentifier?: (name: string) => string | undefined);
    /**
     * Computes line and column from a node's normalised span.
     * For call / new expressions the location points to the first argument
     * (the translation key) rather than the callee, matching the previous
     * string-search behaviour.
     */
    private getLocationFromNode;
    /**
     * Processes function call expressions and new expressions to extract translation keys.
     *
     * This is the core extraction method that handles:
     * - Standard t() calls with string literals
     * - NewExpression calls like new TranslatedError(...)
     * - Selector API calls with arrow functions: `t($ => $.path.to.key)`
     * - Namespace resolution from multiple sources
     * - Default value extraction from various argument patterns
     * - Pluralization and context handling
     * - Key prefix application from scope
     *
     * @param node - Call expression or new expression node to process
     * @param getScopeInfo - Function to retrieve scope information for variables
     */
    handleCallExpression(node: CallExpression, getScopeInfo: (name: string) => ScopeInfo | undefined): void;
    /**
     * Scans a string for nested translations like $t(key, options) and registers
     * the referenced keys (plus their plural / context variants) on the current
     * plugin context.
     */
    private extractNestedKeys;
    private generateNestedPluralKeys;
    /**
     * Processed a call expression to extract keys from the specified argument.
     *
     * @param node - The call expression node
     * @param argIndex - The index of the argument to process
     * @returns An object containing the keys to process and a flag indicating if the selector API is used
     */
    private handleCallExpressionArgument;
    /**
     * Mirror i18next's runtime selector rule (v25.8.19 default, or
     * `enableSelector: 'strict'` when `types.enableSelector === 'strict'`).
     *
     * **Default mode** — rewrite only when the hook was called with a multi-element
     * namespace array and the path's first segment matches a *secondary* namespace.
     * The primary is intentionally not rewritten (preserves #2405): its keys are
     * exposed flat on `$`, so `$.primary.foo` means a literal sub-key.
     *
     * **Strict mode** — every namespace (primary included) is exposed only under
     * its own key on `$`. So a leading segment matching *any* namespace in the
     * scope's list — primary or secondary, single-ns or multi-ns — is rewritten.
     * Mirrors `i18next/src/selector.js` strict branch.
     *
     * In strict mode we also accept a single-ns scope, falling back to
     * `[scopeInfo.defaultNs]` when the scope didn't capture an explicit array
     * (e.g. `useTranslation('only')`).
     *
     * Falls through to the input string when:
     * - the call had no selector (string keys go through this path unchanged),
     * - scope has no namespaces info,
     * - first segment isn't in the scope's namespaces list, or
     * - separators are configured off.
     */
    private applySelectorNsRewrite;
    /**
     * Extracts translation key(s) from selector API arrow function.
     *
     * Processes selector expressions like:
     * - `$ => $.path.to.key` → ['path.to.key']
     * - `$ => $.app['title'].main` → ['app.title.main']
     * - `$ => { return $.nested.key; }` → ['nested.key']
     * - `$ => $.table.columns[field]` → ['table.columns.name', 'table.columns.age']
     *   (when `field` resolves to `"name" | "age"`)
     *
     * Handles both dot notation and bracket notation, respecting
     * the configured key separator or flat key structure. Dynamic
     * bracket expressions are resolved via the expression resolver.
     *
     * @param node - Arrow function expression from selector call
     * @returns Extracted key paths, or empty array if not statically analyzable
     */
    private extractKeysFromSelector;
    /**
     * Recursively extracts key paths from a selector-body expression.
     *
     * On top of the straight MemberExpression walk this also descends into
     * branching forms so keys referenced in either branch are preserved
     * (see #247): ternaries (`cond ? $.a : $.b`), nullish/logical
     * short-circuits (`x ?? $.a`, `x && $.a`, `x || $.a`), and common
     * wrapper nodes (parentheses, TS type assertions).
     */
    private extractKeysFromSelectorExpression;
    /**
     * Generates plural form keys based on the primary language's plural rules.
     *
     * Uses Intl.PluralRules to determine the correct plural categories
     * for the configured primary language and generates suffixed keys
     * for each category (e.g., 'item_one', 'item_other').
     *
     * @param key - Base key name for pluralization
     * @param ns - Namespace for the keys
     * @param options - object expression options
     * @param isOrdinal - isOrdinal flag
     */
    private handlePluralKeys;
    /**
     * Serializes a callee node (Identifier or MemberExpression) into a string.
     *
     * Produces a dotted name for simple callees that can be used for scope lookups
     * or configuration matching.
     *
     * @param callee - The CallExpression callee node to serialize
     * @returns A dotted string name for supported callees, or null when the callee
     *          is a computed/unsupported expression.
     */
    private getFunctionName;
}
//# sourceMappingURL=call-expression-handler.d.ts.map