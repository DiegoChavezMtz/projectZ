'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { publicEnv } from '@/lib/env.public';
import { common } from '@/content/es-MX';
import styles from './Turnstile.module.css';

// Widget de Cloudflare Turnstile con render explícito. Escribe el token en un input oculto `captchaToken`
// del formulario que lo contiene. Para pedir un token nuevo (el anterior es de un solo uso) se remonta con `key`.
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: 'light' | 'dark' | 'auto';
      language?: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile'));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('turnstile'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

type Props = {
  /** Avisa el token vigente (cadena vacía cuando venció o hubo error), para habilitar el envío. */
  onToken?: (token: string) => void;
};

export function Turnstile({ onToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  const [token, setToken] = useState('');
  const [failed, setFailed] = useState(false);
  const labelId = useId();

  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    onTokenRef.current?.(token);
  }, [token]);

  useEffect(() => {
    let widgetId: string | undefined;
    let cancelled = false;
    loadScript()
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        widgetId = api.render(containerRef.current, {
          sitekey: publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
          theme: 'dark',
          language: 'es',
          callback: (value) => {
            setFailed(false);
            setToken(value);
          },
          'expired-callback': () => setToken(''),
          'error-callback': () => {
            setToken('');
            setFailed(true);
          },
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, []);

  return (
    <div className={styles.root} role="group" aria-labelledby={labelId}>
      <span id={labelId} className={styles.label}>
        {common.captcha.label}
      </span>
      <div ref={containerRef} className={styles.widget} />
      <input type="hidden" name="captchaToken" value={token} />
      {failed ? (
        <p className={styles.error} role="alert">
          {common.captcha.error}
        </p>
      ) : null}
    </div>
  );
}
