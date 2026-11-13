'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Spinner } from '@/components/atoms/Spinner';
import { Text } from '@/components/atoms/Text';
import { getCategory } from '@/types/categories';
import type { ClaimItem } from '@/types/claims';
import { scannerContent } from '../../content/scanner';
import { useScannerSession } from '../../hooks/useScannerSession';
import { useThumbnailUrls } from '../../hooks/useThumbnailUrls';
import { BatchReview } from '../BatchReview';
import { CameraCapture } from '../CameraCapture';
import { CaptureStrip } from '../CaptureStrip';
import { CropAdjuster } from '../CropAdjuster';
import { PricePanel } from '../PricePanel';
import styles from './ScannerWorkspace.module.css';

const c = scannerContent;

type Props = {
  sessionId: string;
  categoryId: string;
  /** En un evento ya publicado no se puede omitir el precio. */
  canSkipPrice: boolean;
  items: ClaimItem[];
  editorHref: string;
};

/** Vista a pantalla completa del modo escáner: captura, recorte, precio, tira de capturas y revisión por lotes. */
export function ScannerWorkspace({
  sessionId,
  categoryId,
  canSkipPrice,
  items,
  editorHref,
}: Props) {
  const category = getCategory(categoryId);
  const labels = category.itemLabels;
  const router = useRouter();
  const scanner = useScannerSession({ sessionId, category });
  const [reviewing, setReviewing] = useState(false);
  const thumbs = useThumbnailUrls(
    scanner.entries.map((e) => e.id),
    scanner.loadBlob,
  );

  const stripItems = scanner.stripItems.map((item) => ({ ...item, thumbUrl: thumbs[item.id] }));
  const capturedIds = new Set(scanner.entries.flatMap((e) => (e.itemId ? [e.itemId] : [])));
  const { phase, current } = scanner;

  const openReview = () => {
    router.refresh();
    setReviewing(true);
  };

  if (reviewing)
    return (
      <div className={styles.root}>
        <BatchReview
          sessionId={sessionId}
          category={category}
          items={items}
          capturedIds={capturedIds}
          onBack={() => setReviewing(false)}
          onRepeat={(item) => {
            scanner.startReplace({
              itemId: item.id,
              priceCents: item.price_cents > 0 ? item.price_cents : null,
            });
            setReviewing(false);
          }}
          onFinish={() => {
            scanner.finish();
            router.push(editorHref);
          }}
        />
      </div>
    );

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <Heading level={1} size="xl">
            {c.pageTitle}
          </Heading>
          <Text tone="muted" size="sm">
            {c.intro(labels)}
          </Text>
        </div>
        <div className={styles.headerActions}>
          <Button
            type="button"
            variant="secondary"
            onClick={openReview}
            disabled={scanner.uploadsPending > 0 || scanner.phase !== 'camera'}
          >
            {c.review.open}
          </Button>
          <Button href={editorHref} variant="ghost">
            {c.back}
          </Button>
        </div>
      </header>

      {scanner.error ? (
        <div role="alert" className={styles.problem}>
          <Text tone="danger">{scanner.error.message}</Text>
          <details>
            <summary>{c.camera.technicalDetails}</summary>
            <p className={styles.detail}>
              {c.camera.technicalCode}: {scanner.error.code}
              {scanner.error.detail ? ` — ${scanner.error.detail}` : ''}
            </p>
          </details>
        </div>
      ) : null}
      {scanner.replaceTarget ? (
        <Text role="status" size="sm">
          {c.price.repeat}
          {': '}
          <Button type="button" size="sm" variant="ghost" onClick={scanner.clearReplace}>
            {c.crop.cancel}
          </Button>
        </Text>
      ) : null}
      {scanner.hasErrors ? (
        <Text tone="danger" size="sm">
          {c.strip.status.error}
        </Text>
      ) : null}

      {!scanner.ready ? (
        <div className={styles.loading}>
          <Spinner />
        </div>
      ) : null}

      {/* La cámara sigue montada (oculta) durante el recorte y el precio: no se reabre en cada captura. */}
      {scanner.ready ? (
        <div hidden={phase !== 'camera' && phase !== 'processing'}>
          <CameraCapture
            aspect={scanner.aspect}
            labels={labels}
            disabled={phase !== 'camera'}
            onCapture={scanner.addPhoto}
            detectFrame={scanner.detectFrame}
          />
          {phase === 'processing' ? (
            <Text role="status" aria-live="polite">
              {c.camera.processing}
            </Text>
          ) : null}
        </div>
      ) : null}

      {phase === 'adjust' && current ? (
        <section className={styles.adjust} aria-label={c.crop.title}>
          <Heading level={2} size="lg">
            {c.crop.title}
          </Heading>
          <Text size="sm" tone="muted">
            {current.result.detected ? c.crop.detected : c.crop.manual}
            {current.result.degraded ? ` ${c.crop.degraded}` : ''}
          </Text>
          {current.result.lowResolution ? (
            <Text size="sm" role="status">
              {c.camera.lowResolution}
            </Text>
          ) : null}
          <CropAdjuster
            imageUrl={current.originalUrl}
            imageAspect={current.result.sourceAspect}
            corners={current.corners}
            onChange={scanner.setCorners}
          />
          <div className={styles.row}>
            <Button type="button" onClick={() => void scanner.applyCrop()}>
              {c.crop.apply}
            </Button>
            <Button type="button" variant="ghost" onClick={scanner.discardCurrent}>
              {c.crop.cancel}
            </Button>
          </div>
        </section>
      ) : null}

      {phase === 'price' && current ? (
        <PricePanel
          key={current.resultUrl}
          lowResolution={current.result.lowResolution}
          cropUrl={current.resultUrl}
          aspect={scanner.aspect}
          initialCents={scanner.replaceTarget?.priceCents}
          canSkip={canSkipPrice}
          onDone={(cents) => void scanner.confirm(cents)}
          onAdjust={scanner.adjust}
          onRepeat={scanner.discardCurrent}
        />
      ) : null}

      <CaptureStrip
        items={stripItems}
        aspect={scanner.aspect}
        labels={labels}
        offline={scanner.offline}
        onRetry={scanner.retry}
        onRepeatLast={() => void scanner.repeatLast()}
        onRemoveLast={() => void scanner.removeLast()}
      />
    </div>
  );
}
