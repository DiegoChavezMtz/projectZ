'use client';

import { resendCodeAction, verifyEmailAction } from '../../services/auth.actions';
import { CodeVerifyForm } from '../CodeVerifyForm';

export function VerifyEmailForm({ email, next }: { email?: string; next?: string }) {
  return (
    <CodeVerifyForm
      email={email}
      next={next}
      verifyAction={verifyEmailAction}
      resendAction={resendCodeAction}
    />
  );
}
