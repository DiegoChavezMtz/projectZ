import { Button } from '@/components/atoms/Button';
import { common } from '@/content/es-MX';
import { authContent } from '../../content/es-MX';
import { signOutAction } from '../../services/auth.actions';
import { authService } from '../../services/auth.service';
import { DEFAULT_APP_PATH } from '../../utils/nextPath';
import styles from './SessionMenu.module.css';

/**
 * Acciones de sesión del header público, resueltas en el servidor (sin parpadeo). Una persona con sesión
 * que abre una página pública ve «Ir a mi cuenta» (no se le redirige a la fuerza); el menú completo vive
 * en la barra de la app (`AppUserMenu`).
 */
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

  return (
    <div className={styles.root} role="group" aria-label={authContent.session.menuLabel}>
      <Button href={DEFAULT_APP_PATH} size="sm">
        {authContent.session.goToAccount}
      </Button>
      <form action={signOutAction}>
        <Button type="submit" variant="secondary" size="sm">
          {authContent.account.signOut}
        </Button>
      </form>
    </div>
  );
}
