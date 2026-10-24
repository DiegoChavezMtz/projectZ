// Contenido de la landing. Los bloques marcados TODO_COPY son placeholder: el copy final
// lo entrega producto y se reemplaza aquí sin tocar componentes.
import type { IconName } from '@/components/atoms/Icon';

type Benefit = { icon: IconName; title: string; description: string };

export const landingContent = {
  // TODO_COPY
  meta: {
    title: 'Zlotify: ventas en vivo de artículos de colección',
    description:
      'Vende y compra artículos de colección en vivo. Publica tu claim, reclama al instante, paga y recibe con reputación verificable.',
    ogAlt: 'Zlotify: ventas en vivo de artículos de colección',
    ogTagline: 'Reclama. Paga. Recibe.',
  },
  // TODO_COPY
  hero: {
    eyebrow: 'Ventas en vivo de colección',
    title: 'Reclama tus cartas favoritas, en el momento exacto',
    subtitle:
      'Los vendedores publican sus artículos en un claim en vivo y tú te quedas con lo que quieres al precio publicado. Sin chats eternos, sin confusiones.',
    primaryCta: { label: 'Crear cuenta', href: '/signup' },
    secondaryCta: { label: 'Ver cómo funciona', href: '#como-funciona' },
  },
  // TODO_COPY
  howItWorks: {
    id: 'como-funciona',
    title: 'Cómo funciona',
    subtitle: 'Tres pasos, sin vueltas.',
    steps: [
      {
        icon: 'calendar',
        title: 'El vendedor programa su claim',
        description:
          'Publica fecha, hora y los artículos con su precio. Tú recibes el enlace para entrar a la sala.',
      },
      {
        icon: 'bolt',
        title: 'Reclama en vivo',
        description:
          'Cuando abre el claim, el primero en reclamar un artículo se lo queda. También puedes ofertar por un precio menor.',
      },
      {
        icon: 'receipt',
        title: 'Paga y recibe',
        description:
          'Se genera tu cuenta con todo lo que ganaste. Sube tu comprobante y sigue el envío o la entrega en persona.',
      },
    ] satisfies ReadonlyArray<Benefit>,
  },
  // TODO_COPY
  forSellers: {
    id: 'vendedores',
    title: 'Para vendedores',
    subtitle: 'Vende en vivo con orden y sin perder tiempo.',
    benefits: [
      {
        icon: 'broadcast',
        title: 'Consola en vivo',
        description: 'Ve cada claim y oferta al momento y acepta las que te convengan.',
      },
      {
        icon: 'receipt',
        title: 'Cuentas automáticas',
        description: 'Cada comprador recibe su cuenta con subtotal, envío y total.',
      },
      {
        icon: 'shield',
        title: 'Compradores con historial',
        description: 'Consulta la reputación de quien reclama antes de enviar.',
      },
    ] satisfies ReadonlyArray<Benefit>,
  },
  // TODO_COPY
  forBuyers: {
    id: 'compradores',
    title: 'Para compradores',
    subtitle: 'Reclama con claridad y paga con tranquilidad.',
    benefits: [
      {
        icon: 'clock',
        title: 'Reloj de la sala',
        description:
          'Sabes exactamente cuándo abre cada claim, con hora autoritativa del servidor.',
      },
      {
        icon: 'truck',
        title: 'Junta tus claims',
        description: 'Agrupa varios eventos en un solo envío cuando el vendedor lo permite.',
      },
      {
        icon: 'star',
        title: 'Reputación pública',
        description: 'Vendedores calificados por compradores reales.',
      },
    ] satisfies ReadonlyArray<Benefit>,
  },
  // Ilustración estática: no usa datos reales.
  preview: {
    title: 'Así se ve una sala en vivo',
    subtitle: 'Cada artículo muestra su estado al instante.',
    roomLabel: 'Claim de viernes',
    liveBadge: 'En vivo',
    illustrationLabel:
      'Ilustración de una sala de claim en vivo con artículos en distintos estados',
    items: [
      {
        name: 'Artículo de ejemplo 1',
        price: '$250 MXN',
        status: 'available',
        statusLabel: 'Disponible',
      },
      {
        name: 'Artículo de ejemplo 2',
        price: '$480 MXN',
        status: 'claimed',
        statusLabel: 'Reclamado',
      },
      {
        name: 'Artículo de ejemplo 3',
        price: '$120 MXN',
        status: 'offer',
        statusLabel: 'Con oferta',
      },
    ] as const,
  },
  // TODO_COPY
  faq: {
    id: 'preguntas',
    title: 'Preguntas frecuentes',
    items: [
      {
        question: '¿Qué es un claim?',
        answer:
          'Es un evento de venta en vivo: el vendedor publica artículos y los compradores los reclaman en tiempo real.',
      },
      {
        question: '¿Cuánto cuesta usar Zlotify?',
        answer:
          'Crear una cuenta es gratis. El detalle de costos se anunciará antes del lanzamiento.',
      },
      {
        question: '¿Cómo pago mis claims ganados?',
        answer:
          'El vendedor define los métodos de pago. Tú subes tu comprobante dentro del plazo de la cuenta.',
      },
      {
        question: '¿Qué pasa si alguien no paga?',
        answer:
          'Si vence el plazo sin comprobante, el sistema lo marca como impago en su reputación. El comprador puede dejar una objeción.',
      },
    ],
  },
  // TODO_COPY
  finalCta: {
    title: 'Listo para tu primer claim',
    subtitle: 'Crea tu cuenta gratis y entra a la próxima sala en vivo.',
    cta: { label: 'Crear cuenta', href: '/signup' },
  },
} as const;
