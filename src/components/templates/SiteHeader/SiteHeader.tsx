import Link from 'next/link';
import type { ReactNode } from 'react';
import { common } from '@/content/es-MX';
import { BrandMark } from '../../atoms/BrandMark';
import { Container } from '../../atoms/Container';
import { MotionSwitch } from '../../molecules/MotionSwitch';
import { MobileMenu } from './MobileMenu';
import styles from './SiteHeader.module.css';

type Props = {
  /** Slot de acciones de sesión. Lo inyecta `app/` (en S2 depende del estado de auth). */
  actions: ReactNode;
  nav?: ReadonlyArray<{ label: string; href: string }>;
};

export function SiteHeader({ actions, nav = common.site.nav }: Props) {
  return (
    <header className={styles.root}>
      <Container className={styles.inner}>
        <Link href="/" className={styles.logo} aria-label={common.site.homeLabel}>
          <BrandMark />
          <span>{common.appName}</span>
        </Link>
        <nav className={styles.desktopNav} aria-label={common.site.mainNavLabel}>
          <ul className={styles.links}>
            {nav.map((item) => (
              <li key={item.href}>
                <a className={styles.link} href={item.href}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.desktopActions}>
          <MotionSwitch />
          {actions}
        </div>
        <MobileMenu
          nav={nav}
          actions={
            <>
              {actions}
              <MotionSwitch className={styles.mobileSwitch} />
            </>
          }
        />
      </Container>
    </header>
  );
}
