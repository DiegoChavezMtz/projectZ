'use client';

import { StatusPage, StatusPageAction } from '@/components/templates/StatusPage';
import { common } from '@/content/es-MX';

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  const { title, description, action } = common.error;
  return (
    <StatusPage title={title} description={description}>
      <StatusPageAction label={action} onClick={retry} />
    </StatusPage>
  );
}
