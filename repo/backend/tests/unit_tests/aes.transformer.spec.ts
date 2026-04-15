import {
  encrypt,
  decrypt,
  blindIndex,
  aesTransformer,
  jsonAesTransformer,
} from '../../src/common/transformers/aes.transformer';

describe('aes.transformer', () => {
  const ORIGINAL_KEY = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-1234567890abcdef';
  });

  afterAll(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = ORIGINAL_KEY;
  });

  describe('encrypt/decrypt', () => {
    it('round-trips plaintext', () => {
      const plain = 'hello world';
      const ct = encrypt(plain);
      expect(ct).toContain(':');
      expect(decrypt(ct)).toBe(plain);
    });

    it('produces different ciphertexts for the same input (random IV)', () => {
      expect(encrypt('same')).not.toBe(encrypt('same'));
    });

    it('throws on invalid ciphertext format', () => {
      expect(() => decrypt('not-valid')).toThrow();
    });
  });

  describe('blindIndex', () => {
    it('is deterministic for identical lowercase input', () => {
      expect(blindIndex('admin')).toBe(blindIndex('admin'));
    });

    it('is case-insensitive', () => {
      expect(blindIndex('ADMIN')).toBe(blindIndex('admin'));
    });

    it('differs for different inputs', () => {
      expect(blindIndex('admin')).not.toBe(blindIndex('user'));
    });
  });

  describe('aesTransformer', () => {
    it('to() returns null for null/empty', () => {
      expect(aesTransformer.to(null)).toBeNull();
      expect(aesTransformer.to('')).toBeNull();
      expect(aesTransformer.to(undefined)).toBeNull();
    });

    it('from() returns null for null/empty', () => {
      expect(aesTransformer.from(null)).toBeNull();
      expect(aesTransformer.from('')).toBeNull();
    });

    it('round-trips via to/from', () => {
      const ct = aesTransformer.to('secret');
      expect(aesTransformer.from(ct)).toBe('secret');
    });

    it('from() returns raw value on decrypt failure (legacy fallback)', () => {
      expect(aesTransformer.from('legacy-plaintext')).toBe('legacy-plaintext');
    });
  });

  describe('jsonAesTransformer', () => {
    it('to() returns null for null', () => {
      expect(jsonAesTransformer.to(null)).toBeNull();
      expect(jsonAesTransformer.to(undefined)).toBeNull();
    });

    it('from() returns null for null/empty', () => {
      expect(jsonAesTransformer.from(null)).toBeNull();
      expect(jsonAesTransformer.from('')).toBeNull();
    });

    it('round-trips a JSON object', () => {
      const obj = { threshold: 5000, enabled: true, nested: { a: 1 } };
      const ct = jsonAesTransformer.to(obj);
      expect(jsonAesTransformer.from(ct)).toEqual(obj);
    });

    it('falls back to JSON.parse for legacy unencrypted string', () => {
      const legacy = JSON.stringify({ foo: 'bar' });
      expect(jsonAesTransformer.from(legacy)).toEqual({ foo: 'bar' });
    });
  });
});
