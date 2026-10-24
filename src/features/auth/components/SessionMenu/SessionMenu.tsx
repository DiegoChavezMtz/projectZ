import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { common } from '@/content/es-MX';
import { publicEnv } from '@/lib/env.public';
import { authContent } from '../../content/es-MX';
import { authService } from '../../services/auth.service';
import { signOutAction } from '../../services/auth.actions';
import { profileService } from '../../services/profile.service';
import { avatarPublicUrl } from '../../utils/avatar';
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

  const [profile, seller] = await Promise.all([
    authService.getProfile(user.id),
    profileService.getSeller(user),
  ]);
  const name = profile?.display_name ?? authContent.session.account;
  return (
    <div className={styles.root} role="group" aria-label={authContent.session.menuLabel}>
      {seller ? (
        <Button href="/dashboard" variant="ghost" size="sm">
          {authContent.seller.myShop}
        </Button>
      ) : (
        <Button href="/onboarding/seller" variant="ghost" size="sm">
          {authContent.seller.sell}
        </Button>
      )}
      <Button href="/account" variant="ghost" size="sm">
        <Avatar
          size="sm"
          name={name}
          src={avatarPublicUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, profile?.avatar_path)}
        />
        {name}
      </Button>
      <form action={signOutAction}>
        <Button type="submit" variant="secondary" size="sm">
          {authContent.account.signOut}
        </Button>
      </form>
    </div>
  );
}
