'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ClaimItem } from '@/types/claims';
import type { CategoryDefinition } from '@/types/categories';
import { createCaptureQueue, type CaptureQueue } from '../services/scanner/captureQueue';
import { createIdbCaptureStore, createMemoryCaptureStore } from '../services/scanner/captureStore';
import {
  createScannerPipeline,
  type PipelineResult,
  type ScannerPipeline,
} from '../services/scanner/scannerPipeline';
import { uploadCapture } from '../services/scanner/uploader.client';
import { deleteItemAction } from '../services/claimEvents.actions';
import { scannerContent } from '../content/scanner';
import { pendingCount, type CaptureEntry } from '../utils/scanner/queue';
import type { Quad } from '../utils/scanner/types';
import type { StripItem } from '../components/CaptureStrip';

export type ScannerPhase = 'camera' | 'processing' | 'adjust' | 'price';

export type CurrentCapture = {
  original: Blob;
  originalUrl: string;
  result: PipelineResult;
  resultUrl: string;
  corners: Quad;
};

export type ReplaceTarget = { itemId: string; priceCents: number | null };

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
  const incoming = useRef<Blob[]>([]);
  const busy = useRef(false);
  const pumpRef = useRef<() => void>(() => undefined);
  const [waiting, setWaiting] = useState(0);
  const [phase, setPhase] = useState<ScannerPhase>('camera');
  const [current, setCurrent] = useState<CurrentCapture | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<ReplaceTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    let store;
    try {
      store = createIdbCaptureStore();
    } catch {
      store = createMemoryCaptureStore();
    }
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
    const photo = incoming.current[0];
    if (busy.current || !photo || !pipeline) return;
    incoming.current = incoming.current.slice(1);
    busy.current = true;
    setWaiting(incoming.current.length);
    setPhase('processing');
    setError(null);
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
        if ((e as { name?: string })?.name !== 'AbortError')
          setError(scannerContent.camera.processFailed);
        pumpRef.current();
      });
  }, [aspect, makeUrl]);

  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const addPhoto = useCallback(
    (photo: Blob) => {
      incoming.current = [...incoming.current, photo];
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
    } catch {
      setPhase('adjust');
      setError(scannerContent.camera.processFailed);
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
    if (current || phase === 'processing')
      base.push({ id: 'current', status: 'processing', priceCents: null });
    return base;
  }, [entries, current, phase]);

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
  };
}

export type ScannerSession = ReturnType<typeof useScannerSession>;
export type { ClaimItem };
