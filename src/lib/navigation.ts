import { Href, ImperativeRouter } from 'expo-router';

/**
 * Navigates back when navigator history exists; otherwise replaces with a fallback route
 * so React Navigation never dispatches an unhandled GO_BACK action.
 */
export function navigateBackOrHome(
  router: Pick<ImperativeRouter, 'canGoBack' | 'back' | 'replace'>,
  fallback: Href = '/(tabs)'
): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}

