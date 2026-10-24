import { Button } from '@/components/atoms/Button';
import { common } from '@/content/es-MX';
import { authContent } from '../../content/es-MX';
import { authService } from '../../services/auth.service';
import { signOutAction } from '../../services/auth.actions';
import styles from './SessionMenu.module.css';

/** Acciones de sesión del header, resueltas en el servidor (sin parpadeo). */
export async function SessionMenu() {
  const user = await authService.getUser();
  if (!user) {
    return (
      <>
        <Button href="/login" variant="ghost" size="sm">
          {common.site.auth.login}
        </Button>
        <Button href="/signup" size="sm">
          {common.site.auth.signup}
        </Button>
      </>
    );
  }

  const profile = await authService.getProfile(user.id);
  return (
    <div className={styles.root} role="group" aria-label={authContent.session.menuLabel}>
      <Button href="/account" variant="ghost" size="sm">
        {profile?.display_name ?? authContent.session.account}
      </Button>
      <form action={signOutAction}>
        <Button type="submit" variant="secondary" size="sm">
          {authContent.account.signOut}
        </Button>
      </form>
    </div>
  );
}
