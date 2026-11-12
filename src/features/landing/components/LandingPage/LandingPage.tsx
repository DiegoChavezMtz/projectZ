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

/** Secuencia de bloques: naranja · oscuro · jade · naranja · rosa · oscuro · jade · naranja · oscuro · rosa. */
export function LandingPage() {
  return (
    <div className={styles.root}>
      <JsonLd />
      <Hero />
      <Promises />
      <Categories />
      <HowItWorks />
      <LiveClaimPreview />
      <ForSellers />
      <ForBuyers />
      <Pricing />
      <Faq />
      <FinalCta />
    </div>
  );
}
