'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { startTransition, useActionState, type FormEvent } from 'react';
import { useForm, type FieldValues, type Resolver } from 'react-hook-form';
import { initialActionState, type ActionState } from '../types';

/**
 * Formulario con validación en línea (React Hook Form + Zod) que envía por Server Action.
 * `augment` agrega al FormData lo que no vive en el DOM (p. ej. la imagen ya convertida a WebP).
 * Los errores por campo del servidor se muestran cuando no hay uno local.
 */
export function useClaimForm<T extends FieldValues>(
  schema: Parameters<typeof zodResolver>[0],
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  defaultValues: T,
  augment?: (data: FormData) => void,
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
      augment?.(data);
      startTransition(() => formAction(data));
    })(event);
  };

  const errorFor = (name: string): string | undefined => {
    const local = name
      .split('.')
      .reduce<unknown>(
        (node, key) => (node as Record<string, unknown> | undefined)?.[key],
        form.formState.errors,
      ) as { message?: string } | undefined;
    return local?.message ?? state.fieldErrors?.[name];
  };

  return { form, state, pending, onSubmit, errorFor };
}
