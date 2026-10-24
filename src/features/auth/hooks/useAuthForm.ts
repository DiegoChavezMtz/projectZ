'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { startTransition, useActionState, useState, type FormEvent } from 'react';
import { useForm, type FieldValues, type Resolver } from 'react-hook-form';
import type { ActionState } from '../types';
import { initialActionState } from '../types';

/**
 * Formulario con validación en línea (React Hook Form + Zod) que envía por Server Action.
 * Los errores por campo del servidor tienen prioridad sobre los locales ya mostrados.
 */
export function useAuthForm<T extends FieldValues>(
  schema: Parameters<typeof zodResolver>[0],
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  defaultValues: T,
) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const form = useForm<T>({
    resolver: zodResolver(schema) as unknown as Resolver<T>,
    defaultValues: defaultValues as never,
    mode: 'onTouched',
  });

  // Verificación de seguridad (Turnstile): el token es de un solo uso, así que tras cada respuesta del
  // servidor se pide uno nuevo remontando el widget (`captcha.key`).
  const [token, setToken] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    setToken('');
    setCaptchaKey((n) => n + 1);
  }
  const captcha = { key: captchaKey, onToken: setToken, ready: token !== '' };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const formElement = event.currentTarget;
    return form.handleSubmit(() => {
      const data = new FormData(formElement);
      startTransition(() => formAction(data));
    })(event);
  };

  const errorFor = (name: string): string | undefined =>
    (form.formState.errors as Record<string, { message?: string } | undefined>)[name]?.message ??
    state.fieldErrors?.[name];

  return { form, state, pending, onSubmit, errorFor, captcha };
}
