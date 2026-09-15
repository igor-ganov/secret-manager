export const formatDate = (epochMs: number): string =>
  new Date(epochMs).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
