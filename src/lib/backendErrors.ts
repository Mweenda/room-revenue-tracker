export const BACKEND_UNAVAILABLE_MESSAGE =
  "The authentication service is unavailable. Check your connection and try again.";

export function isBackendUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "AuthRetryableFetchError"
    || /failed to fetch|networkerror|network request failed|load failed/i.test(error.message);
}
