'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { startTransition, useActionState, type FormEvent } from 'react';
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

  return { form, state, pending, onSubmit, errorFor };
}
