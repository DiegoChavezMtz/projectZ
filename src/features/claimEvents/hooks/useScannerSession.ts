'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { reportClientError } from '@/lib/observability/client';
import { logger } from '@/lib/observability/logger';
import type { ClaimItem } from '@/types/claims';
import type { CategoryDefinition } from '@/types/categories';
import { createCaptureQueue, randomId, type CaptureQueue } from '../services/scanner/captureQueue';
import { createIdbCaptureStore, createResilientCaptureStore } from '../services/scanner/captureStore';
import {
  createScannerPipeline,
  type PipelineResult,
  type ScannerPipeline,
} from '../services/scanner/scannerPipeline';
import { ScannerImageError } from '../services/scanner/scannerImage';
import { uploadCapture } from '../services/scanner/uploader.client';
import { deleteItemAction } from '../services/claimEvents.actions';
import { scannerContent } from '../content/scanner';
import { pendingCount, type CaptureEntry } from '../utils/scanner/queue';
import { manualPieceQuad, sortReadingOrder, type MultiWarning } from '../utils/scanner/multi';
import type { Quad } from '../utils/scanner/types';
import type { StripItem } from '../components/CaptureStrip';

export type ScannerPhase = 'camera' | 'processing' | 'adjust' | 'price' | 'pieces' | 'batch';

/** Una foto con una sola pieza (por defecto) o con varias. */
export type CaptureMode = 'single' | 'multi';

export type CurrentCapture = {
  original: Blob;
  originalUrl: string;
  result: PipelineResult;
  resultUrl: string;
  corners: Quad;
};

/** Una pieza detectada en una foto con varias (S11-19). */
export type PieceDraft = {
  id: string;
  /** Esquinas normalizadas (0 a 1) respecto de la foto. */
  corners: Quad;
  /** Pasó la validación, o el vendedor la ajustó a mano. Una pieza inválida debe ajustarse o quitarse. */
  valid: boolean;
  problems: string[];
};

export type MultiCapture = {
  original: Blob;
  originalUrl: string;
  sourceAspect: number;
  pieces: PieceDraft[];
  warnings: MultiWarning[];
};

/** Piezas ya recortadas de una foto, esperando su precio una por una. */
export type PriceBatch = {
  photoId: string;
  results: { result: PipelineResult; url: string }[];
  index: number;
};

export type ReplaceTarget = { itemId: string; priceCents: number | null };

/** Fallo visible: mensaje por causa y detalle técnico para soporte. */
export type ScannerProblem = { message: string; code: string; detail: string };

/** Mensaje por causa y registro del código real (antes todo se reducía a "No pudimos procesar la foto"). */
export function describeProblem(error: unknown): ScannerProblem {
  const code = error instanceof ScannerImageError ? error.code : 'unknown';
  const detail =
    error instanceof ScannerImageError
      ? (error.detail ?? '')
      : error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
  const environment = [
    typeof Worker !== 'undefined' ? 'worker' : 'sin worker',
    typeof OffscreenCanvas !== 'undefined' ? 'offscreen' : 'sin offscreen',
    typeof navigator !== 'undefined' ? navigator.userAgent : '',
  ].join(' · ');
  logger.error('scanner_process_failed', { code, detail, environment });
  reportClientError(error);
  return {
    message: scannerContent.camera.problems[code] ?? scannerContent.camera.processFailed,
    code,
    detail: [detail, environment].filter(Boolean).join(' | '),
  };
}

type Params = { sessionId: string; category: CategoryDefinition };

/**
 * Orquesta el modo escáner: fotos entrantes → pipeline (worker) → ajuste manual si hace falta → precio →
 * cola de subida persistente. Los borradores se crean con `saveCaptureAction` desde la cola.
 */
export function useScannerSession({ sessionId, category }: Params) {
  const aspect = category.imageAspect;
  const pipelineRef = useRef<ScannerPipeline | null>(null);
  const queueRef = useRef<CaptureQueue | null>(null);
  const [entries, setEntries] = useState<CaptureEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const incoming = useRef<{ photo: Blob; mode: CaptureMode }[]>([]);
  const modeRef = useRef<CaptureMode>('single');
  const [captureMode, setCaptureModeState] = useState<CaptureMode>('single');
  const [multi, setMulti] = useState<MultiCapture | null>(null);
  const [batch, setBatch] = useState<PriceBatch | null>(null);
  const busy = useRef(false);
  const pumpRef = useRef<() => void>(() => undefined);
  const [waiting, setWaiting] = useState(0);
  const [phase, setPhase] = useState<ScannerPhase>('camera');
  const [current, setCurrent] = useState<CurrentCapture | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<ReplaceTarget | null>(null);
  const [error, setError] = useState<ScannerProblem | null>(null);
  const urls = useRef<string[]>([]);

  const makeUrl = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urls.current.push(url);
    return url;
  }, []);
  const dropUrl = useCallback((url: string) => {
    URL.revokeObjectURL(url);
    urls.current = urls.current.filter((u) => u !== url);
  }, []);

  // Cola y pipeline: se crean al abrir la vista (carga diferida) y se liberan al salir.
  useEffect(() => {
    const store = createResilientCaptureStore(() => createIdbCaptureStore());
    const queue = createCaptureQueue({ store, upload: uploadCapture });
    queueRef.current = queue;
    pipelineRef.current = createScannerPipeline();
    const off = queue.subscribe(setEntries);
    queueMicrotask(() =>
      setOffline(typeof navigator !== 'undefined' && navigator.onLine === false),
    );
    const online = () => {
      setOffline(false);
      queue.kick();
    };
    const gone = () => setOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', gone);
    void queue
      .load(sessionId)
      .catch(() => [])
      .then(() => setReady(true));
    return () => {
      off();
      window.removeEventListener('online', online);
      window.removeEventListener('offline', gone);
      queue.dispose();
      pipelineRef.current?.dispose();
      queueRef.current = null;
      pipelineRef.current = null;
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current = [];
    };
  }, [sessionId]);

  // Procesa las fotos de una en una (varias a la vez si se eligieron varios archivos).
  const pump = useCallback(() => {
    const pipeline = pipelineRef.current;
    const next = incoming.current[0];
    if (busy.current || !next || !pipeline) return;
    const { photo, mode } = next;
    incoming.current = incoming.current.slice(1);
    busy.current = true;
    setWaiting(incoming.current.length);
    setPhase('processing');
    setError(null);
    if (mode === 'multi') {
      pipeline
        .detectMany(photo, aspect)
        .then((found) => {
          setMulti({
            original: photo,
            originalUrl: makeUrl(photo),
            sourceAspect: found.sourceAspect,
            warnings: found.warnings,
            pieces: found.pieces.map((p) => ({
              id: randomId(),
              corners: p.corners,
              valid: p.valid,
              problems: p.problems,
            })),
          });
          setPhase('pieces');
        })
        .catch((e: unknown) => {
          busy.current = false;
          setPhase('camera');
          if ((e as { name?: string })?.name !== 'AbortError') setError(describeProblem(e));
          pumpRef.current();
        });
      return;
    }
    pipeline
      .process(photo, { aspect })
      .then((result) => {
        setCurrent({
          original: photo,
          originalUrl: makeUrl(photo),
          result,
          resultUrl: makeUrl(result.blob),
          corners: result.corners,
        });
        setPhase(result.detected ? 'price' : 'adjust');
      })
      .catch((e: unknown) => {
        busy.current = false;
        setPhase('camera');
        if ((e as { name?: string })?.name !== 'AbortError') setError(describeProblem(e));
        pumpRef.current();
      });
  }, [aspect, makeUrl]);

  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const addPhoto = useCallback(
    (photo: Blob) => {
      incoming.current = [...incoming.current, { photo, mode: modeRef.current }];
      setWaiting(incoming.current.length);
      pump();
    },
    [pump],
  );

  const closeCurrent = useCallback(() => {
    setCurrent((value) => {
      if (value) {
        dropUrl(value.originalUrl);
        dropUrl(value.resultUrl);
      }
      return null;
    });
    setPhase('camera');
    busy.current = false;
    pump();
  }, [dropUrl, pump]);

  const setCorners = useCallback(
    (corners: Quad) => setCurrent((v) => (v ? { ...v, corners } : v)),
    [],
  );

  /** Reprocesa la foto original con las esquinas ajustadas a mano. */
  const applyCrop = useCallback(async () => {
    const value = current;
    const pipeline = pipelineRef.current;
    if (!value || !pipeline) return;
    setPhase('processing');
    try {
      const result = await pipeline.process(value.original, { aspect, corners: value.corners });
      dropUrl(value.resultUrl);
      setCurrent({ ...value, result, resultUrl: makeUrl(result.blob), corners: result.corners });
      setPhase('price');
    } catch (e) {
      setPhase('adjust');
      setError(describeProblem(e));
    }
  }, [current, aspect, dropUrl, makeUrl]);

  const adjust = useCallback(() => setPhase('adjust'), []);

  /** "Listo": la captura va a la cola (a disco primero) y la cámara queda lista para la siguiente. */
  const confirm = useCallback(
    async (priceCents: number | null) => {
      const value = current;
      const queue = queueRef.current;
      if (!value || !queue) return;
      const target = replaceTarget;
      closeCurrent();
      setReplaceTarget(null);
      await queue.add({
        sessionId,
        blob: value.result.blob,
        priceCents: priceCents ?? target?.priceCents ?? null,
        replaceItemId: target?.itemId ?? null,
      });
    },
    [current, replaceTarget, closeCurrent, sessionId],
  );

  // --- Varias piezas por foto (S11-19) ---------------------------------------------------------------

  const setCaptureMode = useCallback((mode: CaptureMode) => {
    modeRef.current = mode;
    setCaptureModeState(mode);
  }, []);

  const closeMulti = useCallback(() => {
    setMulti((value) => {
      if (value) dropUrl(value.originalUrl);
      return null;
    });
    setPhase('camera');
    busy.current = false;
    pump();
  }, [dropUrl, pump]);

  const removePiece = useCallback(
    (id: string) => setMulti((m) => (m ? { ...m, pieces: m.pieces.filter((p) => p.id !== id) } : m)),
    [],
  );

  /** Ajustar las esquinas es la confirmación del vendedor: la pieza deja de estar "por revisar". */
  const setPieceCorners = useCallback(
    (id: string, corners: Quad) =>
      setMulti((m) =>
        m ? { ...m, pieces: m.pieces.map((p) => (p.id === id ? { ...p, corners, valid: true, problems: [] } : p)) } : m,
      ),
    [],
  );

  /** Pieza añadida a mano: recorte centrado y pequeño que el vendedor arrastra a su lugar. Devuelve su id. */
  const addPiece = useCallback((): string | null => {
    const id = randomId();
    setMulti((m) => {
      if (!m) return m;
      const px = manualPieceQuad({ width: m.sourceAspect, height: 1 }, aspect);
      const corners = px.map((p) => ({ x: p.x / m.sourceAspect, y: p.y })) as Quad;
      return { ...m, pieces: [...m.pieces, { id, corners, valid: true, problems: [] }] };
    });
    return id;
  }, [aspect]);

  const dropBatchUrls = useCallback(
    (value: PriceBatch | null) => value?.results.forEach(({ url }) => dropUrl(url)),
    [dropUrl],
  );

  /** Recorta cada pieza confirmada (en orden de lectura) y pasa al precio pieza por pieza. */
  const confirmPieces = useCallback(async () => {
    const value = multi;
    const pipeline = pipelineRef.current;
    if (!value || !pipeline || value.pieces.length === 0) return;
    setPhase('processing');
    const ordered = sortReadingOrder(value.pieces);
    const results: PriceBatch['results'] = [];
    try {
      for (const piece of ordered) {
        const result = await pipeline.process(value.original, { aspect, corners: piece.corners });
        results.push({ result, url: makeUrl(result.blob) });
      }
    } catch (e) {
      results.forEach(({ url }) => dropUrl(url));
      setPhase('pieces');
      setError(describeProblem(e));
      return;
    }
    dropUrl(value.originalUrl);
    setMulti(null);
    setBatch({ photoId: randomId(), results, index: 0 });
    setPhase('batch');
  }, [multi, aspect, dropUrl, makeUrl]);

  const finishBatch = useCallback(() => {
    setBatch((value) => {
      dropBatchUrls(value);
      return null;
    });
    setPhase('camera');
    busy.current = false;
    pump();
  }, [dropBatchUrls, pump]);

  /** Encola la pieza actual con su precio y avanza a la siguiente (resaltada). */
  const confirmBatchPiece = useCallback(
    async (priceCents: number | null) => {
      const value = batch;
      const queue = queueRef.current;
      if (!value || !queue) return;
      const piece = value.results[value.index];
      if (!piece) return;
      const n = value.index + 1;
      await queue.add({
        sessionId,
        blob: piece.result.blob,
        priceCents,
        id: `${value.photoId}-${n}`,
        after: n > 1 ? `${value.photoId}-${n - 1}` : null,
      });
      if (value.index + 1 >= value.results.length) finishBatch();
      else setBatch({ ...value, index: value.index + 1 });
    },
    [batch, sessionId, finishBatch],
  );

  /** Encola las piezas que faltan sin precio (se completan en la revisión por lotes). */
  const skipRemainingPrices = useCallback(async () => {
    const value = batch;
    const queue = queueRef.current;
    if (!value || !queue) return;
    for (let i = value.index; i < value.results.length; i += 1) {
      const piece = value.results[i];
      if (!piece) continue;
      await queue.add({
        sessionId,
        blob: piece.result.blob,
        priceCents: null,
        id: `${value.photoId}-${i + 1}`,
        after: i > 0 ? `${value.photoId}-${i}` : null,
      });
    }
    finishBatch();
  }, [batch, sessionId, finishBatch]);

  const last = entries[entries.length - 1];

  const repeatLast = useCallback(async () => {
    const queue = queueRef.current;
    if (!queue || !last) return;
    if (last.status === 'done' && last.itemId)
      setReplaceTarget({ itemId: last.itemId, priceCents: last.priceCents });
    await queue.discard(last.id);
  }, [last]);

  const removeLast = useCallback(async () => {
    const queue = queueRef.current;
    if (!queue || !last) return;
    if (last.status === 'done' && last.itemId) await deleteItemAction(sessionId, last.itemId);
    await queue.discard(last.id);
  }, [last, sessionId]);

  const retry = useCallback((id: string) => void queueRef.current?.retry(id), []);

  const detectFrame = useCallback(
    (frame: ImageBitmap) => pipelineRef.current?.detect(frame) ?? Promise.resolve(null),
    [],
  );

  const startReplace = useCallback((target: ReplaceTarget) => setReplaceTarget(target), []);
  const clearReplace = useCallback(() => setReplaceTarget(null), []);

  /** Al terminar: se limpian de IndexedDB las capturas ya subidas. */
  const finish = useCallback(() => void queueRef.current?.clearDone(sessionId), [sessionId]);

  const loadBlob = useCallback(
    (id: string) => queueRef.current?.getBlob(id) ?? Promise.resolve(undefined),
    [],
  );

  const stripItems = useMemo<StripItem[]>(() => {
    const base: StripItem[] = entries.map((e) => ({
      id: e.id,
      status: e.status,
      priceCents: e.priceCents,
      errorCode: e.errorCode,
    }));
    if (current || multi || batch || phase === 'processing')
      base.push({ id: 'current', status: 'processing', priceCents: null });
    return base;
  }, [entries, current, multi, batch, phase]);

  return {
    aspect,
    ready,
    offline,
    phase,
    current,
    entries,
    stripItems,
    pending: pendingCount(entries) + waiting + (phase === 'processing' ? 1 : 0),
    uploadsPending: pendingCount(entries),
    hasErrors: entries.some((e) => e.status === 'error'),
    replaceTarget,
    error,
    addPhoto,
    setCorners,
    applyCrop,
    adjust,
    confirm,
    discardCurrent: closeCurrent,
    repeatLast,
    removeLast,
    retry,
    startReplace,
    clearReplace,
    finish,
    loadBlob,
    detectFrame,
    captureMode,
    setCaptureMode,
    multi,
    removePiece,
    setPieceCorners,
    addPiece,
    confirmPieces,
    retakeMulti: closeMulti,
    batch,
    confirmBatchPiece,
    skipRemainingPrices,
  };
}

export type ScannerSession = ReturnType<typeof useScannerSession>;
export type { ClaimItem };
