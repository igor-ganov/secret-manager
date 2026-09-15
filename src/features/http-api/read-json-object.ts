export type JsonObject = Readonly<Record<string, unknown>>;

const isJsonObject = (value: unknown): value is JsonObject =>
  value instanceof Object && !Array.isArray(value);

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/* A JSON object body or nothing: wrong content type, malformed JSON, arrays
   and scalars all collapse into undefined so routes answer 400 uniformly. */
export const readJsonObject = async (request: Request): Promise<JsonObject | undefined> => {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined;
  }
  const parsed = parseJson(await request.text());
  return isJsonObject(parsed) ? parsed : undefined;
};

export const readString = (object: JsonObject, field: string): string | undefined => {
  const value = object[field];
  return typeof value === 'string' ? value : undefined;
};

export const readNumber = (object: JsonObject, field: string): number | undefined => {
  const value = object[field];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};
