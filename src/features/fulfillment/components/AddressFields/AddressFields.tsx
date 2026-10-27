'use client';

import { Input } from '@/components/atoms/Input';
import { FormField } from '@/components/molecules/FormField';
import { fulfillmentContent } from '../../content/es-MX';
import { ADDRESS_FIELDS, type AddressInput } from '../../utils/address.schemas';
import styles from './AddressFields.module.css';

const c = fulfillmentContent.buyer.address;

export const EMPTY_ADDRESS: Record<(typeof ADDRESS_FIELDS)[number], string> = {
  recipient: '',
  phone: '',
  street: '',
  exterior: '',
  interior: '',
  neighborhood: '',
  city: '',
  state: '',
  postal_code: '',
  references: '',
};

const AUTOCOMPLETE: Record<string, string> = {
  recipient: 'name',
  phone: 'tel',
  street: 'address-line1',
  neighborhood: 'address-level3',
  city: 'address-level2',
  state: 'address-level1',
  postal_code: 'postal-code',
};

type Props = {
  value: AddressInput;
  onChange: (next: AddressInput) => void;
  errors?: Partial<Record<string, string>>;
};

/** Campos de la dirección de envío (controlado). La validación vive en `addressSchema`. */
export function AddressFields({ value, onChange, errors = {} }: Props) {
  return (
    <fieldset className={styles.root}>
      <legend className={styles.legend}>{c.title}</legend>
      <div className={styles.grid}>
        {ADDRESS_FIELDS.map((field) => (
          <div
            key={field}
            className={
              field === 'recipient' || field === 'street' || field === 'references'
                ? styles.wide
                : undefined
            }
          >
            <FormField label={c[field]} error={errors[field]}>
              {(control) => (
                <Input
                  {...control}
                  name={field}
                  value={value[field] ?? ''}
                  autoComplete={AUTOCOMPLETE[field]}
                  inputMode={
                    field === 'phone' ? 'tel' : field === 'postal_code' ? 'numeric' : undefined
                  }
                  onChange={(event) => onChange({ ...value, [field]: event.target.value })}
                />
              )}
            </FormField>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
