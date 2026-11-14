/**
 * Rewrites OS share-extension callback URLs (`dataUrl=...`) and custom `rapidex://add|download`
 * deep links to the root route so Expo Router renders the tab navigator instead of an unmatched screen.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    if (
      path.includes('dataUrl=') ||
      /^(rapidex:\/\/|\/)?(add|download)(\?|\/|$)/i.test(path)
    ) {
      return '/';
    }
    return path;
  } catch {
    return '/';
  }
}

