/**
 * Professional logger utility for Haru Talk.
 *
 * WHY: Replaces direct console calls with a unified logging layer,
 * enabling environment-specific filtering and preventing accidental
 * sensitive data exposure in production bundles.
 */
export const logger = {
  /**
   * Logs informational messages in non-production environments.
   *
   * WHY: Reduces console noise in production while preserving dev-time trace clarity.
   */
  info: (message: string, ...args: unknown[]): void => {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[HaruTalk INFO] ${message}`, ...args); // eslint-disable-line no-console
    }
  },

  /**
   * Logs warnings indicating non-fatal failures or anomalous state.
   *
   * WHY: Surfaces sub-optimal execution paths without interrupting the app.
   */
  warn: (message: string, ...args: unknown[]): void => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[HaruTalk WARN] ${message}`, ...args); // eslint-disable-line no-console
    }
  },

  /**
   * Logs severe errors that affect functionality or data integrity.
   *
   * WHY: Always active (even in production) to enable runtime incident diagnostics.
   */
  error: (message: string, error?: unknown, ...args: unknown[]): void => {
    console.error(`[HaruTalk ERROR] ${message}`, error, ...args); // eslint-disable-line no-console
  },
};
