import type { D1PreparedStatement } from './d1-types.ts';

/* D1 has its own "no row" marker; the rest of the code speaks undefined. */
export const firstRow = async <Row>(statement: D1PreparedStatement): Promise<Row | undefined> => (await statement.first<Row>()) ?? undefined;
