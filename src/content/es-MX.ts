// Textos globales de la app (español de México). Cada feature tiene su propio diccionario.
export const common = {
  appName: 'Zlotify',
  appDescription: 'Ventas en vivo de artículos de colección: reclama, paga y recibe.',
  a11y: {
    loading: 'Cargando',
    close: 'Cerrar',
    skipToContent: 'Saltar al contenido',
  },
  site: {
    homeLabel: 'Zlotify, ir al inicio',
    mainNavLabel: 'Navegación principal',
    footerNavLabel: 'Información legal',
    openMenu: 'Abrir menú',
    closeMenu: 'Cerrar menú',
    nav: [
      { label: 'Cómo funciona', href: '/#como-funciona' },
      { label: 'Para vendedores', href: '/#vendedores' },
      { label: 'Para compradores', href: '/#compradores' },
      { label: 'Precios', href: '/#precios' },
      { label: 'Preguntas', href: '/#preguntas' },
    ],
    auth: { login: 'Iniciar sesión', signup: 'Crear cuenta' },
    footer: {
      terms: 'Términos y condiciones',
      privacy: 'Política de privacidad',
      rights: 'Todos los derechos reservados.',
    },
  },
  codeInput: {
    group: 'Código de verificación',
    digit: (index: number, total: number) => `Dígito ${index} de ${total}`,
  },
  toast: { region: 'Notificaciones' },
  captcha: {
    label: 'Verificación de seguridad',
    error: 'No pudimos cargar la verificación de seguridad. Recarga la página e intenta de nuevo.',
  },
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
