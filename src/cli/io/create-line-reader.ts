export type LineReader = () => Promise<string | undefined>;

/* Pulls one `\n`-terminated line at a time from a byte stream; the last
   unterminated chunk counts as a line, then undefined signals the end. */
export const createLineReader = (stream: ReadableStream<Uint8Array>): LineReader => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let done = false;

  const takeLine = (): string | undefined => {
    const index = pending.indexOf('\n');
    if (index === -1) {
      return undefined;
    }
    const line = pending.slice(0, index).replace(/\r$/, '');
    pending = pending.slice(index + 1);
    return line;
  };

  const drainTail = (): string | undefined => {
    if (pending === '') {
      return undefined;
    }
    const tail = pending;
    pending = '';
    return tail;
  };

  return async () => {
    while (!done) {
      const line = takeLine();
      if (line !== undefined) {
        return line;
      }
      const chunk = await reader.read();
      done = chunk.done;
      pending += decoder.decode(chunk.value, { stream: !done });
    }
    return takeLine() ?? drainTail();
  };
};
