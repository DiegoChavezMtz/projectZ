import { connection } from 'next/server';
import { UserMenu } from '@/components/molecules/UserMenu';
import { common } from '@/content/es-MX';
import { publicEnv } from '@/lib/env.public';
import { authContent } from '../../content/es-MX';
import { signOutAction } from '../../services/auth.actions';
import { authService } from '../../services/auth.service';
import { avatarPublicUrl } from '../../utils/avatar';

/** Menú de usuario de la barra de la app: datos de la sesión resueltos en el servidor. */
export async function AppUserMenu() {
  // La sesión depende de la petición (y de la hora): se resuelve en cada solicitud, no al prerenderizar.
  await connection();
  const { user, profile } = await authService.requireUser('/app');
  const name = profile.display_name || user.email || authContent.session.account;
  const c = common.app.userMenu;
  return (
    <UserMenu
      name={name}
      email={user.email}
      avatarSrc={avatarPublicUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, profile.avatar_path)}
      links={[
        { label: c.profile, href: '/account' },
        { label: c.security, href: '/account/security' },
      ]}
      signOut={
        <form action={signOutAction}>
          <button type="submit">{authContent.account.signOut}</button>
        </form>
      }
    />
  );
}
