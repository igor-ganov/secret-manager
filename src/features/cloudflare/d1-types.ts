/* Minimal structural types for the Cloudflare D1 binding, to avoid pulling
   @cloudflare/workers-types globals that conflict with the bun type set. */
export type D1PreparedStatement = {
  readonly bind: (...values: readonly (string | number)[]) => D1PreparedStatement;
  readonly first: <Row>() => Promise<Row | null>;
  readonly run: () => Promise<unknown>;
  readonly all: <Row>() => Promise<{ readonly results: readonly Row[] }>;
};

export type D1Database = {
  readonly prepare: (query: string) => D1PreparedStatement;
};
