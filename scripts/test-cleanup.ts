// Borra los datos creados por las pruebas (cuentas is_test / @test.zlotify.invalid). Idempotente.
import { cleanupTestData } from '../tests/helpers/cleanup';
import { supabaseCleanupStore } from '../tests/helpers/cleanup.supabase';

async function main() {
  const report = await cleanupTestData(supabaseCleanupStore());
  console.log(
    `Limpieza: ${report.deletedUsers.length} usuarios de prueba borrados, ${report.skipped.length} omitidos (is_test = false).`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
