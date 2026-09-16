'use strict';

/**
 * Default console-based logger implementation for the i18next toolkit.
 * Provides basic logging functionality with different severity levels.
 *
 * @example
 * ```typescript
 * const logger = new ConsoleLogger()
 * logger.info('Extraction started')
 * logger.warn('Deprecated configuration option used')
 * logger.error('Failed to parse file')
 * ```
 */
class ConsoleLogger {
    /**
     * Logs an informational message to the console.
     *
     * @param message - The message to log
     */
    info(message) { console.log(message); }
    /**
     * Logs a warning message to the console.
     *
     * @param message - The warning message to log
     * @param more - Optional additional detail (e.g. a caught error). Forwarded to
     *   `console.warn` so thrown errors surfaced by plugin hooks are not swallowed.
     */
    warn(message, more) {
        if (more === undefined) {
            console.warn(message);
        }
        else {
            console.warn(message, more);
        }
    }
    /**
     * Logs an error message to the console.
     *
     * @param message - The error message to log
     * @param more - Optional additional detail (e.g. a caught error).
     */
    error(message, more) {
        if (more === undefined) {
            console.error(message);
        }
        else {
            console.error(message, more);
        }
    }
}

exports.ConsoleLogger = ConsoleLogger;
