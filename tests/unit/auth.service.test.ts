// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  updateUserById: vi.fn(),
  getUserById: vi.fn(),
  generateLink: vi.fn(),
  signInWithPassword: vi.fn(),
  verifyOtp: vi.fn(),
  profileUpdate: vi.fn(),
  issue: vi.fn(),
  verify: vi.fn(),
  findLatest: vi.fn(),
  send: vi.fn(),
  captchaCheck: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        createUser: mocks.createUser,
        updateUserById: mocks.updateUserById,
        getUserById: mocks.getUserById,
        generateLink: mocks.generateLink,
      },
    },
    from: () => ({ update: () => ({ eq: mocks.profileUpdate }) }),
  }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { signInWithPassword: mocks.signInWithPassword, verifyOtp: mocks.verifyOtp },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  }),
}));
vi.mock('@/lib/supabase/stateless', () => ({ createStatelessClient: () => ({}) }));
vi.mock('@/features/auth/services/captcha.service', () => ({
  captchaService: { check: mocks.captchaCheck },
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/services/email.service', () => ({ emailService: { send: mocks.send } }));
vi.mock('@/features/auth/services/emailCode.service', () => ({
  emailCodeService: { issue: mocks.issue, verify: mocks.verify, findLatest: mocks.findLatest },
}));

import { authService } from '@/features/auth/services/auth.service';
import { AppError } from '@/utils/errors';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.profileUpdate.mockResolvedValue({ error: null });
  mocks.issue.mockResolvedValue({ code: '123456' });
  mocks.captchaCheck.mockResolvedValue(undefined);
});

describe('authService.signUp', () => {
  it('crea el usuario sin confirmar, guarda términos y envía el código', async () => {
    mocks.createUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const result = await authService.signUp({
      email: ' Ana@Mail.com ',
      password: 'abc12345',
      displayName: 'Ana',
    });
    expect(result).toEqual({ status: 'verification_sent' });
    expect(mocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@mail.com', email_confirm: false }),
    );
    expect(mocks.issue).toHaveBeenCalledWith('ana@mail.com', 'verify_email', expect.anything());
    expect(mocks.send).toHaveBeenCalledWith({
      to: 'ana@mail.com',
      template: 'verifyEmail',
      data: { displayName: 'Ana', code: '123456' },
    });
  });

  it('correo ya registrado: ofrece iniciar sesión y NO envía código', async () => {
    mocks.createUser.mockResolvedValue({ data: { user: null }, error: { code: 'email_exists' } });
    const result = await authService.signUp({
      email: 'a@b.co',
      password: 'abc12345',
      displayName: 'Ana',
    });
    expect(result).toEqual({ status: 'email_exists' });
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

describe('authService.signInWithPassword', () => {
  it('mismo error para correo inexistente y contraseña incorrecta', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials' } });
    const a = await authService
      .signInWithPassword({ email: 'no@existe.co', password: 'x' })
      .catch((e) => e);
    const b = await authService
      .signInWithPassword({ email: 'si@existe.co', password: 'y' })
      .catch((e) => e);
    expect(a).toBeInstanceOf(AppError);
    expect([a.code, a.message]).toEqual([b.code, b.message]);
    expect(a.code).toBe('invalid_credentials');
  });

  it('cualquier otro error de Auth también es genérico', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { code: 'unexpected_failure' } });
    await expect(
      authService.signInWithPassword({ email: 'a@b.co', password: 'x' }),
    ).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
  });

  it('no verificado: reenvía el código y avisa', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { code: 'email_not_confirmed' } });
    mocks.findLatest.mockResolvedValue({ user_id: 'u1' });
    mocks.getUserById.mockResolvedValue({
      data: {
        user: { id: 'u1', email_confirmed_at: null, user_metadata: { display_name: 'Ana' } },
      },
    });
    const result = await authService.signInWithPassword({ email: 'a@b.co', password: 'x' });
    expect(result).toEqual({ status: 'unverified' });
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it('no verificado con cooldown vigente: sigue siendo unverified', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { code: 'email_not_confirmed' } });
    mocks.findLatest.mockResolvedValue({ user_id: 'u1' });
    mocks.getUserById.mockResolvedValue({ data: { user: { id: 'u1', email_confirmed_at: null } } });
    mocks.issue.mockRejectedValue(new AppError('cooldown', 'espera', { seconds: 30 }));
    await expect(
      authService.signInWithPassword({ email: 'a@b.co', password: 'x' }),
    ).resolves.toEqual({
      status: 'unverified',
    });
  });
});

describe('authService.resendCode', () => {
  it('correo desconocido: no hace nada ni lo revela', async () => {
    mocks.findLatest.mockResolvedValue(null);
    await expect(authService.resendCode('nadie@x.co')).resolves.toBeUndefined();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('usuario ya confirmado: no envía', async () => {
    mocks.findLatest.mockResolvedValue({ user_id: 'u1' });
    mocks.getUserById.mockResolvedValue({ data: { user: { id: 'u1', email_confirmed_at: 'x' } } });
    await authService.resendCode('a@b.co');
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

describe('authService.verifyEmail', () => {
  it('código inválido: no confirma ni crea sesión', async () => {
    mocks.verify.mockResolvedValue({ ok: false, reason: 'expired' });
    await expect(authService.verifyEmail('a@b.co', '123456')).rejects.toMatchObject({
      code: 'expired',
    });
    expect(mocks.updateUserById).not.toHaveBeenCalled();
    expect(mocks.generateLink).not.toHaveBeenCalled();
  });

  it('código válido: confirma por admin y canjea el magiclink en el cliente de servidor', async () => {
    mocks.verify.mockResolvedValue({ ok: true, id: 'c1', userId: 'u1', payload: {} });
    mocks.updateUserById.mockResolvedValue({ error: null });
    mocks.generateLink.mockResolvedValue({
      data: { properties: { hashed_token: 'th' } },
      error: null,
    });
    mocks.verifyOtp.mockResolvedValue({ error: null });
    await authService.verifyEmail('a@b.co', '123456');
    expect(mocks.updateUserById).toHaveBeenCalledWith('u1', { email_confirm: true });
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ type: 'magiclink', token_hash: 'th' });
  });
});

describe('captcha', () => {
  it('signUp y login se detienen si la verificación de seguridad falla', async () => {
    mocks.captchaCheck.mockRejectedValue(new AppError('captcha_failed', 'no'));
    await expect(
      authService.signUp({ email: 'a@b.co', password: 'abc12345', displayName: 'Ana' }),
    ).rejects.toMatchObject({ code: 'captcha_failed' });
    await expect(
      authService.signInWithPassword({ email: 'a@b.co', password: 'x' }),
    ).rejects.toMatchObject({ code: 'captcha_failed' });
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it('el login pasa a Supabase el token que le deja el captchaService', async () => {
    mocks.captchaCheck.mockResolvedValue('tok');
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    await authService.signInWithPassword({ email: 'a@b.co', password: 'x', captchaToken: 'tok' });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ options: { captchaToken: 'tok' } }),
    );
  });
});
