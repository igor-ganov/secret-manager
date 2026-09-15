const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/* The browser is only ever redirected back to the machine that asked. */
export const isLoopbackCallback = (callback: string): boolean => {
  try {
    const url = new URL(callback);
    return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname) && url.search === '' && url.hash === '';
  } catch {
    return false;
  }
};
