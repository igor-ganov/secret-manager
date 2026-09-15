/* Drops `#tgAuthResult=…` from the address bar so it never lands in
   bookmarks or history; the payload is public profile data, but a stale
   fragment would re-trigger a login on every reload. */
export const clearHash = (history: History, location: Location): void =>
  history.replaceState(history.state, '', `${location.pathname}${location.search}`);
