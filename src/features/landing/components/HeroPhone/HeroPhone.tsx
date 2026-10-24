import Image from 'next/image';
import { Badge } from '@/components/atoms/Badge';
import { landingContent } from '../../content/es-MX';
import styles from './HeroPhone.module.css';

/** Ilustración estática de un claim en el celular. No consume datos reales. */
export function HeroPhone() {
  const { label, seller, liveBadge, viewers, featuredTag, item, action, toast, feed, caption } =
    landingContent.hero.phone;
  return (
    <figure className={styles.stage}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.phone} role="img" aria-label={label}>
        <div className={styles.screen} aria-hidden="true">
          <div className={styles.topbar}>
            <span className={styles.avatar}>{seller.charAt(0)}</span>
            <span className={styles.seller}>{seller}</span>
            <span className={styles.live}>
              <span className={styles.dot} />
              {liveBadge}
            </span>
          </div>
          <p className={styles.viewers}>{viewers}</p>
          <div className={styles.featured}>
            <Image
              src={item.photo.src}
              alt=""
              fill
              preload
              sizes="(min-width: 1024px) 18rem, 70vw"
              className={styles.photo}
            />
            <span className={styles.tag}>{featuredTag}</span>
            <div className={styles.info}>
              <div>
                <p className={styles.name}>{item.name}</p>
                <p className={styles.meta}>{item.meta}</p>
              </div>
              <div className={styles.priceBlock}>
                <p className={styles.price}>{item.price}</p>
                <Badge tone="success">{item.status}</Badge>
              </div>
            </div>
          </div>
          <div className={styles.claim}>{action}</div>
          <ul className={styles.feed}>
            {feed.map((entry) => (
              <li key={entry.what} className={styles.entry}>
                <span>
                  <strong>{entry.who}</strong> {entry.what}
                </span>
                <span className={styles.when}>{entry.when}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={styles.toast} aria-hidden="true">
        <span className={styles.toastIcon}>✓</span>
        <div>
          <p className={styles.toastTitle}>{toast.title}</p>
          <p className={styles.toastDetail}>{toast.detail}</p>
        </div>
      </div>
      <figcaption className={styles.caption}>{caption}</figcaption>
    </figure>
  );
}
