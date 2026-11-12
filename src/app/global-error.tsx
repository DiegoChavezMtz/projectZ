'use client';

import { useEffect } from 'react';
import { StatusPage, StatusPageAction } from '@/components/templates/StatusPage';
import { reportClientError } from '@/lib/observability/client';
import { common } from '@/content/es-MX';
import '@/styles/globals.css';

// Reemplaza al layout raíz cuando éste falla: define su propio documento.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => reportClientError(error), [error]);
  const { title, description, action } = common.error;
  return (
    <html lang="es-MX">
      <body>
        <StatusPage title={title} description={description}>
          <StatusPageAction label={action} onClick={retry} />
        </StatusPage>
      </body>
    </html>
  );
}
