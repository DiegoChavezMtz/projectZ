import { Button } from '@/components/atoms/Button';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import { publicEnv } from '@/lib/env.public';
import { authContent } from '../../content/es-MX';
import { signOutAction } from '../../services/auth.actions';
import { authService } from '../../services/auth.service';
import { avatarPublicUrl } from '../../utils/avatar';
import { AvatarUploader } from '../AvatarUploader';
import { ProfileForm } from '../ProfileForm';
import styles from './AccountView.module.css';

export async function AccountView() {
  const { user, profile } = await authService.requireUser('/account');
  const c = authContent.account;

  return (
    <Container size="narrow" className={styles.root}>
      <Panel tone="raised" className={styles.panel}>
        <Heading level={1} size="xl">
          {c.title}
        </Heading>
        <dl className={styles.list}>
          <div className={styles.row}>
            <Text as="dt" size="sm" tone="muted">
              {c.email}
            </Text>
            <Text as="dd">{user.email ?? ''}</Text>
          </div>
        </dl>
        <AvatarUploader
          name={profile.display_name}
          src={avatarPublicUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, profile.avatar_path)}
        />
        <ProfileForm displayName={profile.display_name} handle={profile.handle} />
        <div className={styles.actions}>
          <Button href="/account/security" variant="secondary">
            {c.security}
          </Button>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost">
              {c.signOut}
            </Button>
          </form>
        </div>
      </Panel>
    </Container>
  );
}
