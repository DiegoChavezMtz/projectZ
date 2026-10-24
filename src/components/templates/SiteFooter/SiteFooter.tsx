import Link from 'next/link';
import { Container } from '../../atoms/Container';
import { common } from '@/content/es-MX';
import styles from './SiteFooter.module.css';

export function SiteFooter() {
  const { footer, footerNavLabel } = common.site;
  return (
    <footer className={styles.root}>
      <Container className={styles.inner}>
        <p className={styles.copy}>
          © {common.appName}. {footer.rights}
        </p>
        <nav aria-label={footerNavLabel}>
          <ul className={styles.links}>
            <li>
              <Link className={styles.link} href="/terminos">
                {footer.terms}
              </Link>
            </li>
            <li>
              <Link className={styles.link} href="/privacidad">
                {footer.privacy}
              </Link>
            </li>
          </ul>
        </nav>
      </Container>
    </footer>
  );
}
