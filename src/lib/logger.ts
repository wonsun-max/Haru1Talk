/**
 * Professional logger utility for Haru Talk.
 * 
 * WHY: This utility replaces direct calls to console.log in production,
 * allowing unified handling of runtime diagnostics, trace filtering,
 * and satisfying security auditing rules by preventing key/sensitive data leaks.
 */
export const logger = {
  /**
   * Logs informational messages in non-production environments.
   * 
   * WHY: Enables trace information during local development while avoiding console clutter in production.
   */
  info: (message: string, ...args: unknown[]): void => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.info(`[HaruTalk INFO] ${message}`, ...args);
    }
  },

  /**
   * Logs warning alerts indicating non-fatal failures or state anomalies.
   * 
   * WHY: Provides a trace of sub-optimal execution flows without interrupting the app.
   */
  warn: (message: string, ...args: unknown[]): void => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`[HaruTalk WARN] ${message}`, ...args);
    }
  },

  /**
   * Logs severe errors that impact functionality or database requests.
   * 
   * WHY: Essential for runtime troubleshooting in both development and production diagnostics.
   */
  error: (message: string, error?: unknown, ...args: unknown[]): void => {
    // eslint-disable-next-line no-console
    console.error(`[HaruTalk ERROR] ${message}`, error, ...args);
  }
};
