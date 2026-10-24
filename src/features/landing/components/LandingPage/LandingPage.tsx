import { Container } from '@/components/atoms/Container';
import { Faq } from '../Faq';
import { FinalCta } from '../FinalCta';
import { ForBuyers } from '../ForBuyers';
import { ForSellers } from '../ForSellers';
import { Hero } from '../Hero';
import { HowItWorks } from '../HowItWorks';
import { JsonLd } from '../JsonLd';
import { LiveClaimPreview } from '../LiveClaimPreview';
import styles from './LandingPage.module.css';

export function LandingPage() {
  return (
    <>
      <JsonLd />
      <Hero />
      <HowItWorks />
      <Container className={styles.audiences}>
        <ForSellers />
        <ForBuyers />
      </Container>
      <LiveClaimPreview />
      <Faq />
      <FinalCta />
    </>
  );
}
