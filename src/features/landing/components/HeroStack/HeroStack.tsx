import { PieceStack } from '@/components/molecules/PieceStack';
import { landingContent } from '../../content/es-MX';
import { LandingPhoto } from '../LandingPhoto';
import styles from './HeroStack.module.css';

const sizes = '(min-width: 900px) 450px, 64vw';

/** Pila del hero: ilustración estática de piezas de ejemplo (no consume datos reales). */
export function HeroStack() {
  const { label, item, caption } = landingContent.hero.phone;
  const [, second, third] = landingContent.preview.items;
  return (
    <div className={styles.stage} role="img" aria-label={`${label}. ${caption}`}>
      <PieceStack
        className={styles.stack}
        front={{ media: <LandingPhoto src={item.photo.src} sizes={sizes} priority /> }}
        back={[
          { media: <LandingPhoto src={second.photo.src} sizes={sizes} priority /> },
          { media: <LandingPhoto src={third.photo.src} sizes={sizes} priority /> },
        ]}
        state={{ kind: 'available', label: item.status }}
        caption={{ name: item.name, price: item.price }}
      />
    </div>
  );
}
