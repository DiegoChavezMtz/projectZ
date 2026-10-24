import { Container } from '@/components/atoms/Container';
import { Categories } from '../Categories';
import { Faq } from '../Faq';
import { FinalCta } from '../FinalCta';
import { ForBuyers } from '../ForBuyers';
import { ForSellers } from '../ForSellers';
import { Hero } from '../Hero';
import { HowItWorks } from '../HowItWorks';
import { JsonLd } from '../JsonLd';
import { LiveClaimPreview } from '../LiveClaimPreview';
import { Pricing } from '../Pricing';
import { Promises } from '../Promises';
import styles from './LandingPage.module.css';

export function LandingPage() {
  return (
    <>
      <JsonLd />
      <Hero />
      <Promises />
      <Categories />
      <HowItWorks />
      <LiveClaimPreview />
      <Container className={styles.audiences}>
        <ForSellers />
        <ForBuyers />
      </Container>
      <Pricing />
      <Faq />
      <FinalCta />
    </>
  );
}
