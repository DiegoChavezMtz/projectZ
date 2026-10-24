import { authContent } from '../../content/es-MX';
import { sanitizeNextPath } from '../../utils/nextPath';
import { AuthCard } from '../AuthCard';
import { LoginForm } from '../LoginForm';
import { SignupForm } from '../SignupForm';
import { VerifyEmailForm } from '../VerifyEmailForm';

// Entradas de las pages: `next` solo viaja si es una ruta interna segura distinta de `/`.
const safeNext = (value: string | undefined) => {
  const path = sanitizeNextPath(value);
  return path === '/' ? undefined : path;
};

export function SignupPage({ next }: { next?: string }) {
  const c = authContent.signup;
  return (
    <AuthCard title={c.title} subtitle={c.subtitle}>
      <SignupForm next={safeNext(next)} />
    </AuthCard>
  );
}

export function LoginPage({ next }: { next?: string }) {
  const c = authContent.login;
  return (
    <AuthCard title={c.title} subtitle={c.subtitle}>
      <LoginForm next={safeNext(next)} />
    </AuthCard>
  );
}

export function VerifyEmailPage({ email, next }: { email?: string; next?: string }) {
  const c = authContent.verify;
  return (
    <AuthCard title={c.title} subtitle={email ? c.subtitle(email) : c.subtitleNoEmail}>
      <VerifyEmailForm email={email} next={safeNext(next)} />
    </AuthCard>
  );
}
