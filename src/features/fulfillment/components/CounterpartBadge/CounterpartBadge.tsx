import { ReputationBadge } from '@/components/molecules/ReputationBadge';
import type { BadgeData } from '@/types/reputation';

/** Reputación de la contraparte de una cuenta o entrega (datos ya cargados con la bandeja). */
export function CounterpartBadge({ badge, name }: { badge: BadgeData | null; name: string }) {
  if (!badge) return null;
  return (
    <ReputationBadge
      compact
      handle={badge.handle}
      name={name}
      winsCount={badge.winsCount}
      isSeller={badge.isSeller}
      rating={badge.rating}
      paidOnTimeRate={badge.paidOnTimeRate}
      isNew={badge.isNew}
    />
  );
}
