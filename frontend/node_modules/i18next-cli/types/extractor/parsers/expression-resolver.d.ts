import type { Expression } from '@swc/core';
import type { ASTVisitorHooks } from '../../types.js';
export declare class ExpressionResolver {
    private hooks;
    private variableTable;
    private sharedEnumTable;
    private typeAliasTable;
    private sharedVariableTable;
    private sharedTypeAliasTable;
    private sharedFunctionReturnTable;
    private temporaryVariables;
    private objectTypeTable;
    private objectTypeMembersRaw;
    private temporaryObjectVariables;
    private arrayElementMembers;
    constructor(hooks: ASTVisitorHooks);
    /**
     * Clear per-file captured variables. Enums / shared maps are kept.
     */
    resetFileSymbols(): void;
    /**
     * Capture a VariableDeclarator node to record simple statically analyzable
     * initializers (string literals, object expressions of string literals,
     * template literals and simple concatenations).
     *
     * This is called during AST traversal before deeper walking so later
     * identifier/member-expression usage can be resolved.
     *
     * @param node - VariableDeclarator-like node (has .id and .init)
     */
    captureVariableDeclarator(node: any): void;
    /**
     * Capture a TypeScript type alias so that `declare const x: AliasName` can
     * be resolved to its string union members later.
     *
     * Handles: `type Foo = 'a' | 'b' | 'c'`
     *
     * SWC node shapes: `TsTypeAliasDeclaration` / `TsTypeAliasDecl`
     */
    captureTypeAliasDeclaration(node: any): void;
    /**
     * Capture a TypeScript interface so that parameters typed by it
     * (`function f({ size }: IProps)` / `f(props: IProps)`) can resolve their
     * members to string-literal unions.
     *
     * SWC node shape: `TsInterfaceDeclaration` with `body.body` members.
     */
    captureInterfaceDeclaration(node: any): void;
    /**
     * Build `{ memberName: possibleStringValues }` for an object-shaped type
     * (interface body or object type-literal members). Only members whose type
     * resolves to a finite string set are kept; returns undefined when none do.
     */
    private collectObjectTypeMembers;
    /**
     * Resolve a type annotation that refers to an object shape (interface, object
     * type alias, or inline type literal) to its member → string values map.
     */
    getObjectTypeMembersRaw(name: string): any[] | undefined;
    resolveTypeMembers(tsType: any): Record<string, string[]> | undefined;
    /**
     * Resolve a type annotation for an array of an object shape (`IProps[]`,
     * `Array<IProps>`, `ReadonlyArray<IProps>`) to the element's member map, so
     * that `items.map(({ size }) => …)` can bind the callback parameter.
     */
    resolveArrayElementMembers(tsType: any): Record<string, string[]> | undefined;
    /**
     * Bind an identifier to the member map of its array element type
     * (`items: IProps[]`).
     */
    setArrayElementMembers(name: string, members: Record<string, string[]>): void;
    getArrayElementMembers(name: string): Record<string, string[]> | undefined;
    deleteArrayElementMembers(name: string): void;
    /**
     * Temporarily bind an identifier to an object-shaped type's members, so that
     * `props.size` inside the function body resolves to the member's values.
     */
    setTemporaryObjectVariable(name: string, members: Record<string, string[]>): void;
    deleteTemporaryObjectVariable(name: string): void;
    /**
     * Capture the return-type annotation of a function declaration so that
     * `t(fn())` calls can be expanded to all union members.
     *
     * Handles both `function f(): 'a' | 'b' { ... }` and
     * `const f = (): 'a' | 'b' => ...` (the arrow-function form is captured
     * via captureVariableDeclarator when the init is an ArrowFunctionExpression).
     *
     * SWC node shapes: `FunctionDeclaration` / `FnDecl`
     */
    captureFunctionDeclaration(node: any): void;
    /**
     * Walk a function body's ReturnStatements and union the statically-resolvable
     * string values of their argument expressions. Does NOT descend into nested
     * function declarations (their returns belong to the inner function, not us).
     *
     * This is how we mirror TypeScript's implicit return-type inference for the
     * purpose of extracting translation keys — we don't need exhaustiveness, just
     * the set of string values any return statement could produce.
     */
    private inferReturnValuesFromFunctionBody;
    /**
     * Extract a raw TsType node from an identifier's type annotation.
     * SWC may wrap it in a `TsTypeAnnotation` node — this unwraps it.
     */
    private extractTypeAnnotation;
    /**
     * Temporarily bind a variable name to a set of string values.
     * Used by ast-visitors to inject .map()/.forEach() callback parameters.
     * Call deleteTemporaryVariable() after walking the callback body.
     */
    setTemporaryVariable(name: string, values: string[]): void;
    /**
     * Remove a previously-injected temporary variable binding.
     */
    deleteTemporaryVariable(name: string): void;
    /**
     * Resolve a TypeScript type annotation to its possible string values.
     * Used by ast-visitors to capture function parameter type annotations
     * (e.g. `field: "name" | "age"`) as temporary variable bindings.
     */
    resolveTypeToStringValues(tsType: any): string[];
    /**
     * Return the array values stored for a variable name, checking all tables.
     * Returns undefined if the name is not a known string array.
     */
    getVariableValues(name: string): string[] | undefined;
    /**
     * Return the as-const object map stored for a variable name.
     * Returns undefined if the name is not a known object map.
     * Checks per-file variableTable first, then sharedEnumTable (for enums).
     */
    getObjectMap(name: string): Record<string, string> | undefined;
    /**
     * Capture a TypeScript enum declaration so members can be resolved later.
     * Accepts SWC node shapes like `TsEnumDeclaration` / `TSEnumDeclaration`.
     *
     * Enums are stored in the shared table so they are available across files.
     */
    captureEnumDeclaration(node: any): void;
    /**
     * Resolves an expression to one or more possible context string values that can be
     * determined statically from the AST. This is a wrapper around the plugin hook
     * `extractContextFromExpression` and {@link resolvePossibleStringValuesFromExpression}.
     *
     * @param expression - The SWC AST expression node to resolve
     * @returns An array of possible context string values that the expression may produce.
     */
    resolvePossibleContextStringValues(expression: Expression): string[];
    /**
     * Resolves an expression to one or more possible key string values that can be
     * determined statically from the AST. This is a wrapper around the plugin hook
     * `extractKeysFromExpression` and {@link resolvePossibleStringValuesFromExpression}.
     *
     * @param expression - The SWC AST expression node to resolve
     * @returns An array of possible key string values that the expression may produce.
     */
    resolvePossibleKeyStringValues(expression: Expression): string[];
    /**
     * Resolves an expression to one or more possible string values that can be
     * determined statically from the AST.
     *
     * Supports:
     * - StringLiteral -> single value (filtered to exclude empty strings for context)
     * - NumericLiteral -> single value
     * - BooleanLiteral -> single value
     * - ConditionalExpression (ternary) -> union of consequent and alternate resolved values
     * - TemplateLiteral -> union of all possible string values
     * - The identifier `undefined` -> empty array
     *
     * For any other expression types (identifiers, function calls, member expressions,
     * etc.) the value cannot be determined statically and an empty array is returned.
     *
     * @param expression - The SWC AST expression node to resolve
     * @param returnEmptyStrings - Whether to include empty strings in the result
     * @returns An array of possible string values that the expression may produce.
     */
    private resolvePossibleStringValuesFromExpression;
    private resolvePossibleStringValuesFromType;
    /**
     * Resolves a template literal string to one or more possible strings that can be
     * determined statically from the AST.
     *
     * @param templateString - The SWC AST template literal string to resolve
     * @returns An array of possible string values that the template may produce.
     */
    private resolvePossibleStringValuesFromTemplateString;
    /**
     * Resolves a template literal type to one or more possible strings that can be
     * determined statically from the AST.
     *
     * @param templateLiteralType - The SWC AST template literal type to resolve
     * @returns An array of possible string values that the template may produce.
     */
    private resolvePossibleStringValuesFromTemplateLiteralType;
}
//# sourceMappingURL=expression-resolver.d.ts.map