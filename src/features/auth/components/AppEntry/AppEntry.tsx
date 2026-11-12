import { redirect } from 'next/navigation';
import { authService } from '../../services/auth.service';
import { profileService } from '../../services/profile.service';
import { DEFAULT_APP_PATH } from '../../utils/nextPath';

/**
 * Puerta de la app (`/app`, destino por defecto tras iniciar sesión): con tienda va a `/dashboard`;
 * sin tienda, a «Mis cuentas» (`/orders`). Quien quiera abrir su espacio entra por «Mi tienda».
 */
export async function AppEntry(): Promise<never> {
  const { user } = await authService.requireUser(DEFAULT_APP_PATH);
  if (await profileService.getSeller(user)) redirect('/dashboard');
  redirect('/orders');
}
