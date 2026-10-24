'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { CodeInput } from '@/components/molecules/CodeInput';
import { FormField } from '@/components/molecules/FormField';
import { authContent } from '../../content/es-MX';
import { useCooldown } from '../../hooks/useCooldown';
import { resendCodeAction, verifyEmailAction } from '../../services/auth.actions';
import { initialActionState } from '../../types';
import { RESEND_COOLDOWN_SECONDS } from '../../utils/emailCode.utils';
import styles from '../AuthForm.module.css';

const c = authContent;

type Props = { email?: string; next?: string };

export function VerifyEmailForm({ email: initialEmail = '', next }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [verifyState, verifyAction, verifying] = useActionState(
    verifyEmailAction,
    initialActionState,
  );
  const [resendState, resendAction, resending] = useActionState(
    resendCodeAction,
    initialActionState,
  );
  // Se acaba de enviar un código (registro o login): el reenvío empieza en cooldown.
  const cooldown = useCooldown(initialEmail ? RESEND_COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (resendState.status === 'success') cooldown.start(RESEND_COOLDOWN_SECONDS);
    if (resendState.code === 'cooldown' && resendState.retryAfter)
      cooldown.start(resendState.retryAfter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resendState]);

  // Tras un fallo el código se limpia para reescribirlo.
  // Tras un fallo se remonta el campo: queda vacío y con el foco en la primera casilla.
  const [attempt, setAttempt] = useState(0);
  const [handled, setHandled] = useState(verifyState);
  if (verifyState !== handled) {
    setHandled(verifyState);
    if (verifyState.status === 'error') {
      setCode('');
      setAttempt((n) => n + 1);
    }
  }

  const submit = (value: string) => {
    if (!formRef.current || !email) return;
    const data = new FormData(formRef.current);
    data.set('code', value);
    startTransition(() => verifyAction(data));
  };

  const verifyError = verifyState.status === 'error' ? verifyState.code : undefined;
  const resendError =
    resendState.status === 'error' && resendState.code !== 'cooldown'
      ? resendState.code
      : undefined;
  const errorText = verifyError ? (c.errors[verifyError] ?? c.errors.unknown) : undefined;

  const resend = () => {
    const data = new FormData();
    data.set('email', email);
    startTransition(() => resendAction(data));
  };

  return (
    <div className={styles.form}>
      <form
        ref={formRef}
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (code.length === 6) submit(code);
        }}
        noValidate
      >
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {initialEmail ? (
          <input type="hidden" name="email" value={email} />
        ) : (
          <FormField label={c.verify.email}>
            {(control) => (
              <Input
                {...control}
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </FormField>
        )}
        <CodeInput
          key={attempt}
          value={code}
          onChange={setCode}
          onComplete={submit}
          name="code"
          disabled={verifying}
          invalid={Boolean(errorText)}
          aria-describedby={errorText ? 'verify-error' : undefined}
          autoFocus
        />
        <div aria-live="polite">
          {errorText ? (
            <Text id="verify-error" tone="danger" role="alert">
              {errorText}
            </Text>
          ) : null}
          {resendState.status === 'success' && cooldown.remaining > 0 ? (
            <Text tone="muted" size="sm">
              {c.verify.resent}
            </Text>
          ) : null}
          {resendError ? (
            <Text tone="danger" size="sm" role="alert">
              {c.errors[resendError] ?? c.errors.unknown}
            </Text>
          ) : null}
        </div>
        <Button type="submit" fullWidth loading={verifying} disabled={code.length !== 6 || !email}>
          {c.verify.submit}
        </Button>
      </form>
      <Button
        variant="ghost"
        fullWidth
        onClick={resend}
        loading={resending}
        disabled={cooldown.remaining > 0 || !email}
      >
        {cooldown.remaining > 0 ? c.verify.resendIn(cooldown.remaining) : c.verify.resend}
      </Button>
    </div>
  );
}
