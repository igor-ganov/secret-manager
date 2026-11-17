/* A file link answers POST with the file as an attachment: -O writes it to
   disk, -J takes the name from Content-Disposition (secret-files AC-2.2). */
export const buildFileCurlSnippet = (url: string): string => `curl -X POST -OJ ${url}`;
