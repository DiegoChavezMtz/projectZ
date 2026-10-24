'use client';

import { StatusPage, StatusPageAction } from '@/components/templates/StatusPage';
import { common } from '@/content/es-MX';
import '@/styles/globals.css';

// Reemplaza al layout raíz cuando éste falla: define su propio documento.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
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
