import { redirect } from 'next/navigation';
import { authContent } from '../../content/es-MX';
import { authService } from '../../services/auth.service';
import { profileService } from '../../services/profile.service';
import { recoveryService } from '../../services/recovery.service';
import { sanitizeNextPath } from '../../utils/nextPath';
import { AuthCard } from '../AuthCard';
import { ForgotPasswordFlow } from '../ForgotPasswordFlow';
import { GoogleButton } from '../GoogleButton';
import { LoginCodeFlow } from '../LoginCodeFlow';
import { ResetPasswordForm } from '../ResetPasswordForm';
import { LoginForm } from '../LoginForm';
import { SignupForm } from '../SignupForm';
import { SellerOnboardingForm } from '../SellerOnboardingForm';
import { TermsOnboarding } from '../TermsOnboarding';
import { VerifyEmailForm } from '../VerifyEmailForm';
import styles from '../AuthForm.module.css';

// Entradas de las pages: `next` solo viaja si es una ruta interna segura distinta de `/`.
const safeNext = (value: string | undefined) => {
  const path = sanitizeNextPath(value);
  return path === '/' ? undefined : path;
};

const Divider = () => (
  <p className={styles.divider} aria-hidden="true">
    {authContent.login.or}
  </p>
);

export function SignupPage({ next }: { next?: string }) {
  const c = authContent.signup;
  return (
    <AuthCard title={c.title} subtitle={c.subtitle}>
      <GoogleButton next={safeNext(next)} />
      <Divider />
      <SignupForm next={safeNext(next)} />
    </AuthCard>
  );
}

type LoginPageProps = {
  next?: string;
  mode?: string;
  error?: string;
  reset?: string;
  signedOut?: string;
};

export function LoginPage({ next, mode, error, reset, signedOut }: LoginPageProps) {
  const c = authContent.login;
  const safe = safeNext(next);
  if (mode === 'code') {
    return (
      <AuthCard title={c.codeTitle} subtitle={c.codeSubtitle}>
        <LoginCodeFlow next={safe} />
      </AuthCard>
    );
  }
  const notice = reset
    ? authContent.notices.reset
    : signedOut
      ? authContent.notices.signedOut
      : undefined;
  return (
    <AuthCard title={c.title} subtitle={c.subtitle}>
      <GoogleButton next={safe} />
      <Divider />
      <LoginForm next={safe} notice={notice} oauthError={error} />
    </AuthCard>
  );
}

export function ForgotPasswordPage({ expired }: { expired?: boolean }) {
  const c = authContent.recovery;
  return (
    <AuthCard title={c.title} subtitle={c.subtitle}>
      <ForgotPasswordFlow expired={expired} />
    </AuthCard>
  );
}

export async function ResetPasswordPage() {
  const c = authContent.recovery;
  // Sin token vigente (cookie firmada de 10 min) no hay nada que restablecer.
  if (!(await recoveryService.readToken())) redirect('/forgot-password');
  return (
    <AuthCard title={c.resetTitle} subtitle={c.resetSubtitle}>
      <ResetPasswordForm />
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

export async function TermsPage({ next }: { next?: string }) {
  const c = authContent.terms;
  const safe = safeNext(next);
  await authService.requireUser(safe ?? '/', { allowPendingTerms: true });
  return (
    <AuthCard title={c.title} subtitle={c.subtitle}>
      <TermsOnboarding next={safe} />
    </AuthCard>
  );
}

export async function SellerOnboardingPage() {
  const c = authContent.seller;
  const { user } = await authService.requireUser('/onboarding/seller');
  if (await profileService.getSeller(user)) redirect('/dashboard');
  return (
    <AuthCard title={c.title} subtitle={c.subtitle}>
      <SellerOnboardingForm />
    </AuthCard>
  );
}
