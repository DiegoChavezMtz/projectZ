'use client';

import { startTransition, useActionState, useRef, useState } from 'react';
import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';
import { VisuallyHidden } from '@/components/atoms/VisuallyHidden';
import { authContent } from '../../content/es-MX';
import { resizeAvatar } from '../../services/avatar.client';
import { uploadAvatarAction } from '../../services/profile.actions';
import { initialActionState } from '../../types';
import { checkAvatarInput } from '../../utils/avatar';
import styles from '../AuthForm.module.css';

const c = authContent.profile;

type Props = { name: string; src: string | null };

/** A10: elige una imagen, la recorta y la pasa a WebP de 512 px en el navegador y la sube con una Server Action. */
export function AvatarUploader({ name, src }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(uploadAvatarAction, initialActionState);
  const [localError, setLocalError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const onChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLocalError(null);
    const problem = checkAvatarInput(file);
    if (problem) return setLocalError(`avatar_${problem}`);
    setPreparing(true);
    const blob = await resizeAvatar(file);
    setPreparing(false);
    if (!blob) return setLocalError('avatar_type');
    const data = new FormData();
    data.set('avatar', new File([blob], 'avatar.webp', { type: 'image/webp' }));
    startTransition(() => action(data));
  };

  const errorCode = localError ?? (state.status === 'error' ? (state.code ?? 'unknown') : null);

  return (
    <div className={styles.avatarRow}>
      <Avatar size="lg" src={src} name={c.avatarAlt(name)} />
      <div className={styles.section}>
        <input
          ref={inputRef}
          id="avatar-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={styles.fileInput}
          onChange={onChange}
          aria-label={c.avatar}
        />
        <Button
          variant="secondary"
          size="sm"
          loading={pending || preparing}
          onClick={() => inputRef.current?.click()}
        >
          {c.avatarChoose}
        </Button>
        <Text size="sm" tone="muted">
          {c.avatarHint}
        </Text>
        <div aria-live="polite">
          {errorCode ? (
            <Text size="sm" tone="danger" role="alert">
              {authContent.errors[errorCode] ?? authContent.errors.unknown}
            </Text>
          ) : state.status === 'success' ? (
            <Text size="sm" role="status">
              {c.avatarSaved}
            </Text>
          ) : null}
        </div>
        <VisuallyHidden>{c.avatar}</VisuallyHidden>
      </div>
    </div>
  );
}
