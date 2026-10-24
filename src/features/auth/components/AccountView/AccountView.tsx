import { Button } from '@/components/atoms/Button';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import { authContent } from '../../content/es-MX';
import { signOutAction } from '../../services/auth.actions';
import { authService } from '../../services/auth.service';
import styles from './AccountView.module.css';

export async function AccountView() {
  const { user, profile } = await authService.requireUser('/account');
  const c = authContent.account;
  const rows = [
    [c.displayName, profile.display_name],
    [c.email, user.email ?? ''],
    [c.handle, `@${profile.handle}`],
  ] as const;

  return (
    <Container size="narrow" className={styles.root}>
      <Panel tone="raised" className={styles.panel}>
        <Heading level={1} size="xl">
          {c.title}
        </Heading>
        <dl className={styles.list}>
          {rows.map(([term, value]) => (
            <div key={term} className={styles.row}>
              <Text as="dt" size="sm" tone="muted">
                {term}
              </Text>
              <Text as="dd">{value}</Text>
            </div>
          ))}
        </dl>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary">
            {c.signOut}
          </Button>
        </form>
      </Panel>
    </Container>
  );
}
