import type { IconName } from '@/components/atoms/Icon';

// Estructura de navegación de la zona de app (S13, UX de Diseño `app-shell`): barra superior con dos
// secciones y menú lateral por sección. Función pura: los textos viven en `common.app` (`labelKey`).
export type SectionId = 'shop' | 'accounts';

export type NavItem = {
  labelKey: 'setup' | 'summary' | 'claims' | 'sales' | 'shopSettings' | 'toPay' | 'history';
  href: string;
  icon: IconName;
  /** `exact`: activo solo en esa ruta; si no, también en sus subrutas. */
  exact?: boolean;
  /** Subrutas que pertenecen a otro ítem (p. ej. `/orders/history` no activa «Por pagar y enviar»). */
  excludes?: ReadonlyArray<string>;
};

type Section = { id: SectionId; href: string; items: ReadonlyArray<NavItem> };

export const APP_SECTIONS: ReadonlyArray<Section> = [
  {
    id: 'shop',
    href: '/dashboard',
    items: [
      { labelKey: 'summary', href: '/dashboard', icon: 'home', exact: true },
      { labelKey: 'claims', href: '/dashboard/claims', icon: 'broadcast' },
      { labelKey: 'sales', href: '/dashboard/orders', icon: 'truck' },
      { labelKey: 'shopSettings', href: '/dashboard/settings', icon: 'settings' },
    ],
  },
  {
    id: 'accounts',
    href: '/orders',
    items: [
      { labelKey: 'toPay', href: '/orders', icon: 'receipt', excludes: ['/orders/history'] },
      { labelKey: 'history', href: '/orders/history', icon: 'clock' },
    ],
  },
];

/** Mi tienda sin configurar: solo la configuración está activa; el resto lleva candado. */
export const SETUP_ITEM: NavItem = {
  labelKey: 'setup',
  href: '/onboarding/seller',
  icon: 'settings',
  exact: true,
};

const within = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

/** Sección de la barra superior a la que pertenece una ruta (`/onboarding/seller` es de «Mi tienda»). */
export function sectionForPath(pathname: string): SectionId {
  if (within(pathname, '/dashboard') || within(pathname, '/onboarding/seller')) return 'shop';
  return 'accounts';
}

export function isItemActive(pathname: string, item: NavItem): boolean {
  if (item.excludes?.some((path) => within(pathname, path))) return false;
  return item.exact ? pathname === item.href : within(pathname, item.href);
}
