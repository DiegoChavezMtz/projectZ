import type { ReactNode } from 'react';
import { common } from '@/content/es-MX';
import { Button } from '../../atoms/Button';
import { SiteFooter } from '../SiteFooter';
import { SiteHeader } from '../SiteHeader';
import styles from './PageShell.module.css';

type Props = {
  children: ReactNode;
  /** Acciones de sesión del header. Por defecto, enlaces a login y signup (S2 las reemplaza según la sesión). */
  headerActions?: ReactNode;
};

export function PageShell({ children, headerActions }: Props) {
  const { auth } = common.site;
  return (
    <div className={styles.root}>
      <a className={styles.skip} href="#contenido">
        {common.a11y.skipToContent}
      </a>
      <SiteHeader
        actions={
          headerActions ?? (
            <>
              <Button href="/login" variant="ghost" size="sm">
                {auth.login}
              </Button>
              <Button href="/signup" size="sm">
                {auth.signup}
              </Button>
            </>
          )
        }
      />
      <main id="contenido" className={styles.main}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
