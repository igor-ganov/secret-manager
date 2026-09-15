import type { MessageEntity } from 'grammy/types';
import { buildCurlSnippet } from '../sharing/build-curl-snippet.ts';

export type LinkMessage = {
  readonly text: string;
  readonly entities: readonly MessageEntity[];
};

/* The snippet is marked as a `pre` block entity: Telegram renders it as a
   code block with a one-tap copy button, and entities (unlike parse_mode)
   guarantee user-provided text around it can never break formatting. */
export const buildLinkMessage = (intro: string, url: string, ttlMinutes: number): LinkMessage => {
  const snippet = buildCurlSnippet(url);
  const text = `${intro}\n${url}\n\n${snippet}\n\nValid for ${ttlMinutes} minutes, opens once.`;
  return {
    text,
    entities: [
      { type: 'pre', language: 'bash', offset: text.indexOf(snippet), length: snippet.length },
    ],
  };
};
