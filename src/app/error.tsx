'use client';

import { useEffect } from 'react';
import { StatusPage, StatusPageAction } from '@/components/templates/StatusPage';
import { reportClientError } from '@/lib/observability/client';
import { common } from '@/content/es-MX';

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => reportClientError(error), [error]);
  const { title, description, action } = common.error;
  return (
    <StatusPage title={title} description={description}>
      <StatusPageAction label={action} onClick={retry} />
    </StatusPage>
  );
}
