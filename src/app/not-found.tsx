import { StatusPage, StatusPageAction } from '@/components/templates/StatusPage';
import { common } from '@/content/es-MX';

export default function NotFound() {
  const { code, title, description, action } = common.notFound;
  return (
    <StatusPage code={code} title={title} description={description}>
      <StatusPageAction label={action} href="/" />
    </StatusPage>
  );
}
