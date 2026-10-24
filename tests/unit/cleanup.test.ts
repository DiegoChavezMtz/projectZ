// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { cleanupTestData, type CleanupStore } from '../helpers/cleanup';

function fakeStore() {
  const users = new Map<string, string>([
    ['u-test', 'a@test.zlotify.invalid'],
    ['u-test-noprofile', 'b@test.zlotify.invalid'],
    ['u-flagged-real', 'c@test.zlotify.invalid'], // dominio de prueba pero is_test = false: no se toca
    ['u-real', 'persona@gmail.com'],
  ]);
  const profiles = new Map<string, boolean>([
    ['u-test', true],
    ['u-flagged-real', false],
    ['u-real', false],
  ]);
  let outboxCleared = 0;
  const store: CleanupStore = {
    listAuthUsers: async () => [...users].map(([id, email]) => ({ id, email })),
    getProfileFlags: async (ids) =>
      new Map(ids.filter((id) => profiles.has(id)).map((id) => [id, profiles.get(id)!])),
    deleteUser: async (id) => void users.delete(id),
    deleteOutboxForTestAddresses: async () => void outboxCleared++,
  };
  return { store, users, outboxCleared: () => outboxCleared };
}

describe('test:cleanup', () => {
  it('borra solo cuentas de prueba y respeta is_test = false', async () => {
    const { store, users } = fakeStore();
    const report = await cleanupTestData(store);
    expect(report.deletedUsers.sort()).toEqual(['u-test', 'u-test-noprofile']);
    expect(report.skipped).toEqual(['u-flagged-real']);
    expect([...users.keys()].sort()).toEqual(['u-flagged-real', 'u-real']);
  });

  it('es idempotente', async () => {
    const { store, users } = fakeStore();
    await cleanupTestData(store);
    const second = await cleanupTestData(store);
    expect(second.deletedUsers).toEqual([]);
    expect([...users.keys()].sort()).toEqual(['u-flagged-real', 'u-real']);
  });

  it('nunca borra usuarios reales aunque no tengan perfil', async () => {
    const { store, users } = fakeStore();
    users.set('u-real-noprofile', 'otra@example.com');
    await cleanupTestData(store);
    expect(users.has('u-real-noprofile')).toBe(true);
  });
});
