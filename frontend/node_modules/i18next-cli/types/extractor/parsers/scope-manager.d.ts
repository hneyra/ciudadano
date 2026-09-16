import type { Expression, VariableDeclarator } from '@swc/core';
import type { ScopeInfo, I18nextToolkitConfig } from '../../types.js';
export declare class ScopeManager {
    private scopeStack;
    private config;
    private scope;
    private thisFieldStack;
    private simpleConstants;
    private simpleConstantObjects;
    private simpleConstantArrays;
    private paramDefaults;
    identifierFallback?: (name: string) => string | undefined;
    private sharedConstants;
    private sharedConstantObjects;
    constructor(config: Omit<I18nextToolkitConfig, 'plugins'>);
    /**
     * Recursively unwraps TypeScript type assertion wrappers to reach the
     * underlying expression node.
     */
    private static unwrapTsExpression;
    /**
     * Extracts a string value from a variable declarator's TypeScript type
     * annotation when it is a literal string type (e.g., `const ns: 'users'`).
     */
    private static extractStringFromTypeAnnotation;
    /**
     * Reset per-file scope state.
     *
     * This clears both the scope stack and the legacy scope map. It should be
     * called at the start of processing each file so that scope info does not
     * leak between files.
     */
    reset(): void;
    /**
     * Pushes a new class scope used for tracking class field → ScopeInfo
     * mappings. Should be called when entering a ClassDeclaration or
     * ClassExpression.
     */
    enterClassScope(): void;
    /**
     * Pops the current class scope. Should be called when leaving a
     * ClassDeclaration or ClassExpression.
     */
    exitClassScope(): void;
    /**
     * Records a class field's ScopeInfo so that later `this.<field>` or
     * `this.<field>()` accesses inside the class can inherit the namespace
     * and keyPrefix from its initializer.
     *
     * @param fieldName - Field name (private fields are prefixed with `#`)
     * @param info - Scope information derived from the field's initializer
     */
    setThisField(fieldName: string, info: ScopeInfo): void;
    /**
     * Looks up a class field's ScopeInfo from the innermost class scope outward.
     *
     * @param fieldName - Field name (private fields are prefixed with `#`)
     * @returns Scope information if found, undefined otherwise
     */
    getThisField(fieldName: string): ScopeInfo | undefined;
    /**
     * Enters a new variable scope by pushing a new scope map onto the stack.
     * Used when entering functions to isolate variable declarations.
     */
    enterScope(): void;
    /**
     * Exits the current variable scope by popping the top scope map.
     * Used when leaving functions to clean up variable tracking.
     */
    exitScope(): void;
    /**
     * Stores variable information in the current scope.
     * Used to track translation functions and their configuration.
     *
     * @param name - Variable name to store
     * @param info - Scope information about the variable
     */
    setVarInScope(name: string, info: ScopeInfo): void;
    /**
     * Retrieves variable information from the scope chain.
     * Searches from innermost to outermost scope.
     *
     * @param name - Variable name to look up
     * @returns Scope information if found, undefined otherwise
     */
    getVarFromScope(name: string): ScopeInfo | undefined;
    private getUseTranslationConfig;
    /**
     * Resolve simple identifier declared in-file to its string literal value, if known.
     */
    setParamDefault(name: string, value: string): void;
    deleteParamDefault(name: string): void;
    resolveSimpleStringIdentifier(name: string): string | undefined;
    /**
     * Resolve a MemberExpression node (e.g., `ns.custom`) to its string value
     * by looking up the object in `simpleConstantObjects`.
     */
    private resolveSimpleMemberExpression;
    /**
     * Handles variable declarations that might define translation functions.
     *
     * Processes two patterns:
     * 1. `const { t } = useTranslation(...)` - React i18next pattern
     * 2. `const t = i18next.getFixedT(...)` - Core i18next pattern
     *
     * Extracts namespace and key prefix information for later use.
     *
     * @param node - Variable declarator node to process
     */
    handleVariableDeclarator(node: VariableDeclarator): void;
    /**
     * Handles useTranslation calls for comment scope resolution.
     * This is a separate method to store scope info in the legacy scope map
     * that the comment parser can access.
     *
     * @param node - Variable declarator with useTranslation call
     * @param callExpr - The CallExpression node representing the useTranslation invocation
     * @param hookConfig - Configuration describing argument positions for namespace and keyPrefix
     */
    private handleUseTranslationForComments;
    /**
     * Processes useTranslation hook declarations to extract scope information.
     *
     * Handles various destructuring patterns:
     * - `const [t] = useTranslation('ns')` - Array destructuring
     * - `const { t } = useTranslation('ns')` - Object destructuring
     * - `const { t: myT } = useTranslation('ns')` - Aliased destructuring
     *
     * Extracts namespace from the first argument and keyPrefix from options.
     *
     * @param node - Variable declarator with useTranslation call
     * @param callExpr - The CallExpression node representing the useTranslation invocation
     * @param hookConfig - Configuration describing argument positions for namespace and keyPrefix
     */
    private handleUseTranslationDeclarator;
    /**
     * Processes getFixedT function declarations to extract scope information.
     *
     * Handles the pattern: `const t = i18next.getFixedT(lng, ns, keyPrefix)`
     * - Ignores the first argument (language)
     * - Extracts namespace from the second argument
     * - Extracts key prefix from the third argument
     *
     * @param node - Variable declarator with getFixedT call
     * @param callExpr - The CallExpression node representing the getFixedT invocation
     */
    private handleGetFixedTDeclarator;
    /**
     * Resolves a call argument expression to a string value by handling string
     * literals, previously-declared local/shared constants (Identifier), member
     * expressions referencing constant objects, and simple template literals
     * without interpolation. Returns undefined when the expression cannot be
     * resolved statically.
     */
    /**
     * Resolve the `ns` argument of useTranslation to `{ defaultNs, namespaces }`.
     *
     * - String literal / identifier / member-expr → single `defaultNs`, no array.
     * - Array expression → first element becomes `defaultNs`, every statically
     *   resolvable element ends up in `namespaces` (preserving order).
     *
     * `namespaces` is only set when the input was an array form, so consumers can
     * distinguish `useTranslation('a')` (single, `namespaces` undefined) from
     * `useTranslation(['a'])` (single-element array, `namespaces = ['a']`).
     * The runtime selector rule from v25.8.19 only applies when length > 1, so
     * either single form behaves identically downstream.
     */
    private resolveNsArg;
    /**
     * If `init` is a function (optionally wrapped in `useCallback(fn, deps)`) whose
     * first parameter is passed as the first argument to a call of an already-scoped
     * variable (e.g. `tLocal(key, opts)`), return that variable's ScopeInfo.
     */
    private resolveDelegatingWrapperScope;
    private resolveStringArg;
    /**
     * Handles cases where a getFixedT-like function is a variable (from a custom hook)
     * and is invoked to produce a bound `t` function, e.g.:
     *   const { getFixedT } = useTranslate('prefix')
     *   const t = getFixedT('en', 'ns')
     *
     * We combine the original source variable's scope (keyPrefix/defaultNs) with
     * any namespace/keyPrefix arguments provided to this call and attach the
     * resulting scope to the newly declared variable.
     */
    private handleGetFixedTFromVariableDeclarator;
    /**
     * Returns the field name being referenced when an expression takes the form
     * `this.<field>` or `this.<field>()`. Strips the call wrapper if present and
     * prefixes private fields with `#`.
     *
     * Returns undefined if the expression is not such an access.
     */
    private static extractThisFieldName;
    /**
     * Attaches the given ScopeInfo to all destructured variables of a variable
     * declarator (`const { t } = ...`, `const [t] = ...`, or `const t = ...`).
     */
    private attachScopeToDestructuredVars;
    /**
     * Registers a class field's initializer with the current class scope so that
     * later `const { t } = this.<field>` or `const { t } = this.<field>()` calls
     * inside the class body inherit the namespace and keyPrefix from the field
     * initializer.
     *
     * Recognizes the same useTranslation-like patterns supported on regular
     * variable declarations (configured via `useTranslationNames`).
     *
     * @param fieldName - Field name (private fields are prefixed with `#`)
     * @param value - The field initializer expression
     */
    registerClassField(fieldName: string, value: Expression | null | undefined): void;
    /**
     * Computes ScopeInfo (defaultNs, keyPrefix) for a useTranslation-style call
     * given a hook configuration that describes argument positions. Mirrors the
     * extraction performed by handleUseTranslationDeclarator without attaching
     * the result to any variable.
     */
    private computeScopeInfoFromHookCall;
}
//# sourceMappingURL=scope-manager.d.ts.map