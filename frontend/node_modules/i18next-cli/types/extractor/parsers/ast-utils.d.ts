import type { Expression, ObjectExpression, TemplateLiteral } from '@swc/core';
/**
 * Returns the 0-based index of the first real token in the source code,
 * skipping leading whitespace, single-line comments (`//`), multi-line
 * comments, and hashbang lines (`#!`).
 *
 * This is needed because SWC's `Module.span.start` points to the first
 * token, not to byte 0 of the source. Knowing the first token's index
 * lets us compute the true base offset for span normalisation:
 * `base = ast.span.start - findFirstTokenIndex(code)`.
 */
export declare function findFirstTokenIndex(code: string): number;
/**
 * Recursively normalizes all SWC span offsets in an AST by subtracting a base
 * offset. SWC's `parse()` accumulates byte offsets across successive calls in
 * the same process, so `span.start`/`span.end` values can exceed the length of
 * the source file. Call this once on the root `Module` node right after parsing
 * to make every span file-relative (0-based index into the source string).
 *
 * The correct base is `ast.span.start - findFirstTokenIndex(code)` because
 * SWC uses 1-based byte positions and `Module.span.start` points to the first
 * token, not to byte 0 of the source.
 *
 * @param node  - Any AST node (or the root Module)
 * @param base  - The base offset to subtract
 */
export declare function normalizeASTSpans(node: any, base: number): void;
/**
 * Computes 1-based line and 0-based column numbers from a byte offset in source code.
 *
 * @param code   - The full source code string
 * @param offset - A character offset (e.g. from a normalised `node.span.start`)
 * @returns `{ line, column }` or `undefined` when the offset is out of range
 */
export declare function lineColumnFromOffset(code: string, offset: number): {
    line: number;
    column: number;
} | undefined;
/**
 * Builds a lookup table from UTF-8 byte offsets to JavaScript string character
 * indices (UTF-16 code-unit positions).
 *
 * SWC internally represents source as UTF-8 and reports AST spans as byte
 * offsets into that representation.  MagicString and all JavaScript String
 * methods operate on UTF-16 code-unit indices.  For files that contain only
 * ASCII characters the two coincide, so this function returns `null` as a
 * fast path.  For files with multi-byte characters (emoji, accented letters,
 * CJK, etc.) the returned array allows O(1) conversion of any byte offset.
 */
export declare function buildByteToCharMap(content: string): number[] | null;
/**
 * Recursively converts every `span.start` / `span.end` in an SWC AST from
 * UTF-8 byte offsets to JavaScript string character indices using the
 * pre-built lookup table.
 */
export declare function convertSpansToCharIndices(node: any, byteToChar: number[]): void;
/**
 * Normalises every span in a freshly parsed SWC AST to a file-relative UTF-16
 * character index — the unit JavaScript strings, MagicString and
 * `lineColumnFromOffset` all use.
 *
 * Combines the two steps that must always happen together: subtracting SWC's
 * accumulated base (which is expressed in UTF-8 *bytes*, hence the
 * `Buffer.byteLength` of the leading trivia) and converting the remaining byte
 * offsets to char indices.
 */
export declare function normalizeSpansToCharIndices(ast: any, code: string): void;
/**
 * Scans `code` for ignore-directive comments and returns a Set of 1-based line
 * numbers whose issues/strings should be suppressed.
 *
 * A directive on line `D` targets the following line `D + 1`. The behaviour
 * depends on the directive variant:
 *
 *   - `i18next-instrument-ignore-next-line` suppresses only line `D + 1`.
 *   - `i18next-instrument-ignore` suppresses the **entire JSX element** that
 *     begins on line `D + 1` — i.e. every line from its opening tag through its
 *     closing tag, including nested children. This makes a single directive
 *     cover multi-line elements (e.g. `<div … css={…}>…</div>`) and elements
 *     with nested children, instead of just the one physical line after it.
 *
 * When no AST node begins on the targeted line (e.g. the next line is a plain
 * `t()` call rather than a JSX element), block scope falls back to suppressing
 * the single targeted line, preserving the original line-based behaviour.
 *
 * `ast` spans must already be normalised to file-relative character indices
 * (see {@link normalizeASTSpans} / {@link convertSpansToCharIndices}).
 */
export declare function collectIgnoredLineRanges(ast: any, code: string): Set<number>;
/**
 * Finds and returns the full property node (KeyValueProperty) for the given
 * property name from an ObjectExpression.
 *
 * Matches both identifier keys (e.g., { ns: 'value' }) and string literal keys
 * (e.g., { 'ns': 'value' }).
 *
 * This helper returns the full property node rather than just its primitive
 * value so callers can inspect expression types (ConditionalExpression, etc.).
 *
 * @private
 * @param object - The SWC ObjectExpression to search
 * @param propName - The property name to locate
 * @returns The matching KeyValueProperty node if found, otherwise undefined.
 */
export declare function getObjectProperty(object: ObjectExpression, propName: string): import("@swc/types").KeyValueProperty | undefined;
/**
 * Finds and returns the value node for the given property name from an ObjectExpression.
 *
 * Matches both identifier keys (e.g., { ns: 'value' }), string literal keys
 * (e.g., { 'ns': 'value' }) and shorthand properties (e.g., { ns }).
 *
 * This helper returns the full value node rather than just its primitive
 * value so callers can inspect expression types (ConditionalExpression, etc.).
 *
 * @private
 * @param object - The SWC ObjectExpression to search
 * @param propName - The property name to locate
 * @returns The matching value node if found, otherwise undefined.
 */
export declare function getObjectPropValueExpression(object: ObjectExpression, propName: string): Expression | undefined;
/**
 * Checks if the given template literal has no interpolation expressions
 *
 * @param literal - Template literal to check
 * @returns Boolean true if the literal has no expressions and can be parsed (no invalid escapes), false otherwise
 *
 * @private
 */
export declare function isSimpleTemplateLiteral(literal: TemplateLiteral): boolean;
type IdentifierResolver = (name: string) => string | boolean | number | undefined;
/**
 * Extracts string value from object property.
 *
 * Looks for properties by name and returns their string values.
 * Used for extracting options like 'ns', 'defaultValue', 'context', etc.
 *
 * @param object - Object expression to search
 * @param propName - Property name to find
 * @param identifierResolver - callback to resolve Identifier type values when needed
 * @returns String value if found, empty string if property exists but isn't a string, undefined if not found
 *
 * @private
 */
export declare function getObjectPropValue(object: ObjectExpression, propName: string, identifierResolver?: IdentifierResolver): string | boolean | number | undefined;
export {};
//# sourceMappingURL=ast-utils.d.ts.map