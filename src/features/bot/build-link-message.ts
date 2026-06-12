import type { MessageEntity } from 'grammy/types';

export type LinkMessage = {
  readonly text: string;
  readonly entities: readonly MessageEntity[];
};

/* The same /s/<token> url answers GET with a confirmation page and POST with
   the secret itself, so the snippet lets scripts skip the browser entirely.
   The snippet is marked as a `pre` block entity: Telegram renders it as a
   code block with a one-tap copy button, and entities (unlike parse_mode)
   guarantee user-provided text around it can never break formatting. */
export const buildLinkMessage = (intro: string, url: string, ttlMinutes: number): LinkMessage => {
  const snippet = `curl -X POST ${url}`;
  const text = `${intro}\n${url}\n\n${snippet}\n\nValid for ${ttlMinutes} minutes, opens once.`;
  return {
    text,
    entities: [
      { type: 'pre', language: 'bash', offset: text.indexOf(snippet), length: snippet.length },
    ],
  };
};
