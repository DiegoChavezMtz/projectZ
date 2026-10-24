// Textos globales de la app (español de México). Cada feature tiene su propio diccionario.
export const common = {
  appName: 'Zlotify',
  appDescription: 'Ventas en vivo de artículos de colección: reclama, paga y recibe.',
  notFound: {
    code: '404',
    title: 'No encontramos esta página',
    description: 'Puede que el enlace esté roto o que la página ya no exista.',
    action: 'Ir al inicio',
  },
  error: {
    title: 'Algo salió mal',
    description: 'Tuvimos un problema inesperado. Intenta de nuevo en unos segundos.',
    action: 'Reintentar',
  },
} as const;
