export function logError(context: string, error: unknown): void {
  if (__DEV__) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[rapidex:${context}] ${message}`);
  }
}

