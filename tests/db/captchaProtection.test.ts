import { describe, expect, it } from 'vitest';
import { anonClient } from '../helpers/supabase';
import { createTestUser } from '../helpers/users';

// A14: con Captcha protection ON en Supabase (GATE-MANUAL de S3-10, docs/supabase-setup.md), una llamada directa
// al endpoint de Auth sin token debe fallar. Solo corre cuando SUPABASE_CAPTCHA_ENABLED=true.
describe.skipIf(process.env.SUPABASE_CAPTCHA_ENABLED !== 'true')(
  'Captcha protection de Supabase (llamada directa a Auth)',
  () => {
    it('signInWithPassword sin captchaToken falla', async () => {
      const user = await createTestUser();
      const { data, error } = await anonClient().auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });
      expect(data.session).toBeNull();
      expect(error?.message.toLowerCase()).toMatch(/captcha/);
    });
  },
);
