/* Narrows a parsed JSON body to a wire type; undefined means "not that shape". */
export type Decoder<T> = (body: unknown) => T | undefined;
