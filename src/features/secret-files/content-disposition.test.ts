import { describe, expect, test } from 'bun:test';
import { attachmentDisposition } from './content-disposition.ts';

describe('attachmentDisposition (secret-files AC-2.2)', () => {
  test('an ASCII name is quoted as is and repeated as filename*', () => {
    expect(attachmentDisposition('report.pdf')).toBe(`attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`);
  });

  test('a non-ASCII name gets an ASCII fallback and an RFC 5987 filename*', () => {
    expect(attachmentDisposition('résumé (1).pdf')).toBe(
      `attachment; filename="r_sum_ (1).pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9%20%281%29.pdf`,
    );
  });

  test('quotes and backslashes cannot break out of the quoted fallback', () => {
    expect(attachmentDisposition('a"b\\c\'d*.txt')).toBe(`attachment; filename="a_b_c'd*.txt"; filename*=UTF-8''a%22b%5Cc%27d%2A.txt`);
  });
});
