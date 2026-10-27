'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';
import { FormField } from '@/components/molecules/FormField';
import { useToast } from '@/context/ToastContext';
import { AppError } from '@/utils/errors';
import { fulfillmentContent } from '../../content/es-MX';
import { useRunAction } from '../../hooks/useRunAction';
import { submitProofAction } from '../../services/fulfillment.actions';
import { uploadProof } from '../../services/proofUpload.client';
import { addressSchema, type AddressInput } from '../../utils/address.schemas';
import { PROOF_ACCEPT } from '../../utils/proofFile';
import { AddressFields, EMPTY_ADDRESS } from '../AddressFields';
import styles from './ProofUploader.module.css';

const c = fulfillmentContent.buyer.proof;

type Props = {
  target: 'order' | 'delivery';
  targetId: string;
  /** Envío al momento: la dirección es obligatoria antes del primer comprobante. */
  needsAddress?: boolean;
  /** Entrega en persona sin acumular: nota opcional con el punto acordado. */
  allowPickupNote?: boolean;
  title?: string;
};

/** Sube el comprobante (imágenes comprimidas en el navegador) y lo registra con la acción del servidor. */
export function ProofUploader({ target, targetId, needsAddress, allowPickupNote, title }: Props) {
  const toast = useToast();
  const { pending, run } = useRunAction();
  const [inputKey, setInputKey] = useState(0);
  const noteId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [address, setAddress] = useState<AddressInput>(EMPTY_ADDRESS);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [note, setNote] = useState('');
  const busy = uploading || pending;

  const submit = async () => {
    if (!file) {
      toast.show(c.chooseFile, 'info');
      return;
    }
    let parsedAddress: unknown;
    if (needsAddress) {
      const checked = addressSchema.safeParse(address);
      if (!checked.success) {
        const next: Partial<Record<string, string>> = {};
        for (const issue of checked.error.issues) next[String(issue.path[0])] ??= issue.message;
        setErrors(next);
        return;
      }
      setErrors({});
      parsedAddress = checked.data;
    }

    setUploading(true);
    let path: string;
    try {
      path = await uploadProof(targetId, file);
    } catch (error) {
      toast.show(
        error instanceof AppError ? error.message : 'Algo salió mal. Intenta de nuevo.',
        'danger',
      );
      return;
    } finally {
      setUploading(false);
    }

    run(
      () =>
        submitProofAction({
          target,
          targetId,
          filePath: path,
          ...(parsedAddress ? { address: parsedAddress } : {}),
          ...(allowPickupNote && note.trim() ? { pickupNote: note.trim() } : {}),
        }),
      c.sent,
      () => {
        setFile(null);
        setNote('');
        setInputKey((key) => key + 1);
      },
    );
  };

  return (
    <form
      className={styles.root}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Heading level={3} size="md">
        {title ?? c.title}
      </Heading>
      {needsAddress ? (
        <>
          <Text size="sm" tone="muted">
            {c.needAddress}
          </Text>
          <AddressFields value={address} onChange={setAddress} errors={errors} />
        </>
      ) : null}
      {allowPickupNote ? (
        <div className={styles.field}>
          <label htmlFor={noteId} className={styles.label}>
            {c.pickupNoteLabel}
          </label>
          <Textarea
            id={noteId}
            rows={2}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Text size="sm" tone="muted">
            {c.pickupNoteHint}
          </Text>
        </div>
      ) : null}
      <FormField label={c.file} hint={c.fileHint}>
        {(control) => (
          <Input
            {...control}
            key={inputKey}
            type="file"
            accept={PROOF_ACCEPT}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        )}
      </FormField>
      <Button type="submit" loading={busy} disabled={!file}>
        {uploading ? c.uploading : c.submit}
      </Button>
    </form>
  );
}
