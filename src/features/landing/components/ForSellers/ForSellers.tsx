import { Button } from '@/components/atoms/Button';
import { landingContent } from '../../content/es-MX';
import { Band } from '../Band';
import { BenefitList } from '../BenefitList';
import { SectionHeader } from '../SectionHeader';
import styles from './ForSellers.module.css';

export function ForSellers() {
  const { id, title, subtitle, benefits, cta } = landingContent.forSellers;
  return (
    <Band id={id} color="dark" labelledBy={`${id}-title`} receives="stack">
      <SectionHeader id={`${id}-title`} title={title} subtitle={subtitle} />
      <BenefitList items={benefits} />
      <Button href={cta.href} className={styles.cta}>
        {cta.label}
      </Button>
    </Band>
  );
}
