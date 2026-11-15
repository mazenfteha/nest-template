/**
 * Helpers so error logs read the same way whatever was thrown:
 *
 *   this.logger.error(`Upload of ${key} failed: ${errorMessage(err)}`, errorStack(err));
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function errorStack(err: unknown): string | undefined {
  return err instanceof Error ? err.stack : undefined;
}
