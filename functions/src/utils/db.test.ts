import { describe, it, expect, beforeAll } from '@jest/globals';

describe('Database Utility', () => {
  beforeAll(() => {
    // Mock Firebase Admin
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  });

  it('should export a Firestore instance', async () => {
    const { db } = await import('./db');

    expect(db).toBeDefined();
    expect(db.collection).toBeDefined();
    expect(typeof db.collection).toBe('function');
  });

  it('should allow accessing collections', async () => {
    const { db } = await import('./db');

    const collection = db.collection('test');
    expect(collection).toBeDefined();
  });
});
