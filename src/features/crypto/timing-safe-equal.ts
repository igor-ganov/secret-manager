/* Compares two strings without early exit so a hash mismatch does not leak
   how many leading characters were right. */
export const timingSafeEqual = (left: string, right: string): boolean => {
  const length = Math.max(left.length, right.length);
  const mismatch = Array.from({ length }, (_, index) =>
    (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0),
  ).reduce((accumulated, bits) => accumulated | bits, left.length ^ right.length);
  return mismatch === 0;
};
