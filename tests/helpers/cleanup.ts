import { TEST_EMAIL_DOMAIN } from './users';

/** Acceso a datos que necesita la limpieza (inyectable para probar sin base). */
export type CleanupStore = {
  listAuthUsers: () => Promise<{ id: string; email: string | undefined }[]>;
  /** id → is_test para los usuarios que ya tienen perfil. Los que no tienen perfil no aparecen. */
  getProfileFlags: (ids: string[]) => Promise<Map<string, boolean>>;
  deleteUser: (id: string) => Promise<void>;
  deleteOutboxForTestAddresses: () => Promise<void>;
};

export type CleanupReport = { deletedUsers: string[]; skipped: string[] };

/**
 * Borra solo cuentas de prueba: correo @test.zlotify.invalid Y (sin perfil, o perfil con is_test = true).
 * Una fila con is_test = false nunca se toca. Idempotente.
 */
export async function cleanupTestData(store: CleanupStore): Promise<CleanupReport> {
  const users = await store.listAuthUsers();
  const candidates = users.filter((u) => u.email?.toLowerCase().endsWith(TEST_EMAIL_DOMAIN));
  const flags = await store.getProfileFlags(candidates.map((u) => u.id));

  const report: CleanupReport = { deletedUsers: [], skipped: [] };
  for (const user of candidates) {
    if (flags.get(user.id) === false) {
      report.skipped.push(user.id);
      continue;
    }
    await store.deleteUser(user.id);
    report.deletedUsers.push(user.id);
  }

  await store.deleteOutboxForTestAddresses();
  return report;
}
