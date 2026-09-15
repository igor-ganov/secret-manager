const BASE: RequestInit = {
  credentials: 'same-origin',
  headers: { 'content-type': 'application/json' },
};

/* Bodiless requests must not carry `body: undefined` (exact optional types). */
export const buildRequestInit = (method: string, body: unknown): RequestInit => {
  switch (typeof body) {
    case 'undefined':
      return { ...BASE, method };
    default:
      return { ...BASE, method, body: JSON.stringify(body) };
  }
};
