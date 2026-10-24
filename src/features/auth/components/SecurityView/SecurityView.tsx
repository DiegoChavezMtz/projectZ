import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { Panel } from '@/components/molecules/Panel';
import { authContent } from '../../content/es-MX';
import { accountService, hasPassword } from '../../services/account.service';
import { authService } from '../../services/auth.service';
import { ChangeEmailForm } from '../ChangeEmailForm';
import { ChangePasswordForm } from '../ChangePasswordForm';
import { DangerZone } from '../DangerZone';
import { SessionsPanel } from '../SessionsPanel';
import styles from './SecurityView.module.css';

export async function SecurityView({ emailChanged }: { emailChanged?: boolean }) {
  const { user, profile } = await authService.requireUser('/account/security');
  const pendingEmail = await accountService.getPendingEmailChange(user.id);
  const password = hasPassword(user);

  return (
    <Container size="narrow" className={styles.root}>
      <Heading level={1} size="xl">
        {authContent.security.title}
      </Heading>
      {emailChanged ? (
        <Text role="status" className={styles.notice}>
          {authContent.security.email.changed}
        </Text>
      ) : null}
      <Panel tone="raised" className={styles.panel}>
        <ChangePasswordForm hasPassword={password} />
      </Panel>
      <Panel tone="raised" className={styles.panel}>
        <ChangeEmailForm
          currentEmail={user.email ?? ''}
          hasPassword={password}
          pendingEmail={pendingEmail}
        />
      </Panel>
      <Panel tone="raised" className={styles.panel}>
        <SessionsPanel />
      </Panel>
      <Panel tone="raised" className={styles.panel}>
        <DangerZone handle={profile.handle} />
      </Panel>
      <Button href="/account" variant="ghost">
        {authContent.security.back}
      </Button>
    </Container>
  );
}
