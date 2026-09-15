/* The same /s/<token> url answers GET with a confirmation page and POST with
   the secret itself, so this snippet lets scripts skip the browser entirely. */
export const buildCurlSnippet = (url: string): string => `curl -X POST ${url}`;
