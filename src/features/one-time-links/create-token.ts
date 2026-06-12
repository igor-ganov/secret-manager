export const createToken = (): string =>
  `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '');
