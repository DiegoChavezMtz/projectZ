// Contenido de la landing. Los bloques marcados TODO_COPY son copy propuesto por producto y
// pendiente de validar con vendedores reales; se reemplazan aquí sin tocar componentes.
// Las fotos de /public/landing son marcadores de Unsplash (licencia Unsplash); se cambian
// por material propio sin tocar componentes. Nombres, precios y cifras de las ilustraciones son ficticios.
import type { IconName } from '@/components/atoms/Icon';

type Benefit = { icon: IconName; title: string; description: string };
type Photo = { src: string; alt: string };

const photos = {
  card: { src: '/landing/cards-1.jpg', alt: 'Carta coleccionable holográfica' },
  dragon: {
    src: '/landing/minis-1.jpg',
    alt: 'Miniatura pintada a mano de un jinete sobre dragón',
  },
  captain: { src: '/landing/minis-2.jpg', alt: 'Miniatura pintada de un guerrero con espadas' },
  carsCase: { src: '/landing/cars-1.jpg', alt: 'Autos a escala en una vitrina' },
  carsRow: { src: '/landing/cars-2.jpg', alt: 'Autos a escala de colección alineados' },
} satisfies Record<string, Photo>;

export const landingContent = {
  // TODO_COPY
  meta: {
    title: 'Zlotify: la plaza en vivo de los coleccionistas',
    description:
      'Haz tus claims en vivo, ordenados y sin caos. Cartas, miniaturas y más: reclama al instante, paga y recibe. Comprar es gratis y vender no cobra comisión.',
    ogAlt: 'Zlotify: la plaza en vivo de los coleccionistas',
    ogTagline: 'Reclama. Paga. Recibe.',
  },
  // TODO_COPY
  hero: {
    eyebrow: 'Claims en vivo para coleccionistas',
    titleLead: 'El claim de Facebook,',
    titleAccent: 'sin el caos.',
    subtitle:
      'Cartas, miniaturas y más. Todas las piezas del claim en una sola pantalla, en vivo y con la hora del servidor. Si llegaste primero, lo ves al instante.',
    primaryCta: { label: 'Quiero mi primer claim', href: '/signup' },
    secondaryCta: { label: 'Soy vendedor', href: '#precios' },
    proof: ['Comprar es gratis', 'Cero comisión por venta', 'Sin descargar nada'],
    phone: {
      label:
        'Ilustración de ejemplo de un claim en vivo en el celular, con una carta destacada y la actividad de la sala',
      seller: 'Cartas del Centro',
      liveBadge: 'En vivo',
      viewers: '128 viendo',
      featuredTag: 'La joya del claim',
      item: {
        name: 'Carta holográfica',
        meta: 'Español · Near Mint',
        price: '$1,800',
        status: 'Disponible',
        photo: photos.card,
      },
      action: 'Claim',
      toast: { title: '¡Tuyo, Luis!', detail: 'Llegó primero a las 20:00:02' },
      feed: [
        { who: 'Ana', what: 'reclamó Dragón pintado', when: 'hace 2 s' },
        { who: 'Luis', what: 'se llevó Capitán de unidad', when: 'hace 9 s' },
        { who: 'Marco', what: 'mandó una oferta', when: 'hace 15 s' },
      ],
      caption: 'Ilustración de ejemplo',
    },
  },
  // TODO_COPY
  categories: {
    id: 'categorias',
    title: 'Una plaza para todo lo que coleccionas',
    subtitle: 'Arrancamos con las comunidades que ya viven de los claims. Vamos por más.',
    tiles: [
      {
        title: 'Cartas coleccionables',
        description: 'Pokémon, Yu-Gi-Oh!, One Piece, Magic y todo lo que se juega y se colecciona.',
        photo: photos.card,
        badge: null,
      },
      {
        title: 'Miniaturas',
        description: 'Wargames, kits y piezas pintadas a mano. Cada una, única.',
        photo: photos.dragon,
        badge: null,
      },
      {
        title: 'Autos a escala',
        description: 'Hot Wheels, die-cast y ediciones de colección.',
        photo: photos.carsRow,
        badge: 'Muy pronto',
      },
    ],
    soonLabel: 'También en camino',
    soon: ['Figuras', 'Cómics', 'Monedas', 'LEGO', 'Lo que tú colecciones'],
  },
  // TODO_COPY
  promises: {
    label: 'Lo que prometemos',
    items: [
      {
        value: '$0',
        title: 'de comisión por venta',
        description: 'El dinero va directo del comprador a ti.',
      },
      {
        value: '10 min',
        title: 'de alarma antes',
        description: 'El claim se guarda en tu calendario con el link directo.',
      },
      {
        value: '0 dudas',
        title: 'sobre quién llegó primero',
        description: 'La hora del servidor decide y todos la ven.',
      },
      {
        value: 'Gratis',
        title: 'para compradores',
        description: 'Entras desde un link, sin descargar nada.',
      },
    ],
  },
  // TODO_COPY
  howItWorks: {
    id: 'como-funciona',
    title: 'Cómo funciona',
    subtitle: 'Tres pasos, cero vueltas.',
    steps: [
      {
        icon: 'calendar',
        title: 'El vendedor anuncia su claim',
        description:
          'Programa fecha, hora y piezas, y comparte un solo link en sus grupos de siempre.',
      },
      {
        icon: 'bolt',
        title: 'Reclamas con un toque',
        description:
          'Guárdalo en tu calendario con alarma. Cuando abre, un toque y la pieza es tuya, o manda tu oferta.',
      },
      {
        icon: 'receipt',
        title: 'Pagas y recibes, todo en un lugar',
        description:
          'Tu cuenta junta lo que ganaste. Sube tu comprobante y elige envío o entrega en mano.',
      },
    ] satisfies ReadonlyArray<Benefit>,
  },
  // Ilustración estática: no usa datos reales.
  // Claims reales abiertos y próximos (solicitud 2026-11-13). TODO_COPY: textos provisionales para Marketing.
  openClaims: {
    id: 'claims-abiertos',
    title: 'Claims abiertos y próximos',
    subtitle: 'Lo que hay ahora en Zlotify. Entra al claim y elige tu pieza.',
    live: 'Abierto ahora',
    scheduled: 'Próximo',
    startsAt: (when: string) => `Empieza ${when}`,
    startedAt: (when: string) => `Desde ${when}`,
    pieces: (n: number) => (n === 1 ? '1 pieza' : `${n} piezas`),
    seller: (name: string) => `Espacio: ${name}`,
    open: 'Ver claim',
    photosLabel: 'Piezas de muestra',
    emptyTitle: 'Por ahora no hay claims abiertos ni próximos',
    emptyText: 'Cuando un vendedor publique uno, aparecerá aquí. Mientras, así se ve una sala:',
    exampleLabel: 'Ejemplo',
  },
  preview: {
    id: 'sala-en-vivo',
    title: 'Así se ve una sala en vivo',
    subtitle:
      'Cada pieza muestra su estado al instante: disponible, reclamada, con oferta o vendida.',
    roomLabel: 'Claim de viernes',
    liveBadge: 'En vivo',
    illustrationLabel:
      'Ilustración de una sala de claim en vivo con piezas en distintos estados y la actividad reciente',
    items: [
      {
        name: 'Carta holográfica',
        meta: 'Español · Near Mint',
        price: '$1,800',
        status: 'available',
        statusLabel: 'Disponible',
        photo: photos.card,
      },
      {
        name: 'Dragón pintado a mano',
        meta: 'Reclamada por Ana',
        price: '$950',
        status: 'claimed',
        statusLabel: 'Reclamada',
        photo: photos.dragon,
      },
      {
        name: 'Capitán de unidad',
        meta: '2 ofertas pendientes',
        price: '$480',
        status: 'offer',
        statusLabel: 'Con oferta',
        photo: photos.captain,
      },
      {
        name: 'Autos a escala',
        meta: 'Tuyo, Luis',
        price: '$620',
        status: 'sold',
        statusLabel: 'Vendida',
        photo: photos.carsCase,
      },
    ] as const,
    activityTitle: 'Actividad',
    activity: [
      { who: 'Luis', what: 'se llevó Autos a escala', when: '20:03:41' },
      { who: 'Marco', what: 'mandó una oferta por Capitán de unidad', when: '20:02:58' },
      { who: 'Ana', what: 'reclamó Dragón pintado a mano', when: '20:00:02' },
      { who: 'Cartas del Centro', what: 'abrió el claim', when: '20:00:00' },
    ],
  },
  // TODO_COPY
  forSellers: {
    id: 'vendedores',
    title: 'Para vendedores',
    subtitle: 'Tu claim en vivo y tu administración en automático.',
    benefits: [
      {
        icon: 'broadcast',
        title: 'Consola en vivo',
        description:
          'Ve cada claim y oferta al momento, da el "tuyo" con un toque y acepta las ofertas que te convengan.',
      },
      {
        icon: 'receipt',
        title: 'Cuentas que se arman solas',
        description:
          'Al cerrar, cada comprador tiene su cuenta con lo que ganó, el total y su comprobante.',
      },
      {
        icon: 'truck',
        title: 'Envíos consolidados',
        description:
          'Junta los claims de cada comprador en un solo paquete y marca lo enviado y lo entregado.',
      },
      {
        icon: 'shield',
        title: 'Compradores con historial',
        description: 'Mira su reputación antes de dar el "tuyo". Los que no pagan se notan.',
      },
    ] satisfies ReadonlyArray<Benefit>,
    cta: { label: 'Ver planes', href: '#precios' },
  },
  // TODO_COPY
  forBuyers: {
    id: 'compradores',
    title: 'Para compradores',
    subtitle: 'Entérate a tiempo, reclama con claridad y lleva tu cuenta ordenada.',
    benefits: [
      {
        icon: 'calendar',
        title: 'Alarma 10 minutos antes',
        description:
          'Agrega el claim a tu calendario, en iPhone o Android. Que no se te pase otro.',
      },
      {
        icon: 'clock',
        title: 'Quién llegó primero, sin dudas',
        description:
          'Orden por hora del servidor, visible para todos. Se acabó el "yo comenté antes".',
      },
      {
        icon: 'star',
        title: 'Reputación a la vista',
        description: 'Vendedores calificados por compradores reales y compradores que sí pagan.',
      },
      {
        icon: 'receipt',
        title: 'Tu cuenta, acumulada',
        description: 'Lo que ganas con cada vendedor, junto y con el total a pagar.',
      },
    ] satisfies ReadonlyArray<Benefit>,
    cta: { label: 'Crear cuenta gratis', href: '/signup' },
  },
  // TODO_COPY: límites y contenido de cada plan por validar con vendedores.
  pricing: {
    id: 'precios',
    title: 'Compras gratis. Vendes desde $50 al mes.',
    subtitle: 'Cero comisión por venta: lo que vendes es tuyo.',
    trial: {
      title: 'Prueba gratis',
      description: 'Tus primeros 3 claims van por nuestra cuenta. Sin tarjeta.',
    },
    plans: [
      {
        id: 'basico',
        name: 'Básico',
        price: '$50',
        period: 'MXN al mes',
        tagline: 'Para vender con orden, a tu ritmo.',
        badge: null,
        highlighted: false,
        features: [
          'Hasta 5 claims al mes',
          'Consola de claims en vivo',
          'Cuentas, pagos y comprobantes',
          'Entregas y envíos consolidados',
          'Reputación pública',
        ],
        cta: { label: 'Empezar gratis', href: '/signup' },
      },
      {
        id: 'pro',
        name: 'Pro',
        price: '$100',
        period: 'MXN al mes',
        tagline: 'Para quien vende seguido o tiene tienda.',
        badge: 'Sin límite de claims',
        highlighted: true,
        features: [
          'Claims ilimitados al mes',
          'Todo lo del plan Básico',
          'Soporte prioritario',
          'Acceso anticipado a nuevas funciones',
        ],
        cta: { label: 'Empezar gratis', href: '/signup' },
      },
    ],
    buyerNote: {
      title: 'Comprar es siempre gratis',
      description: 'Crea tu cuenta, sigue a tus vendedores y reclama sin pagar nada a Zlotify.',
    },
    footnote: 'Precios en pesos mexicanos (MXN).',
  },
  // TODO_COPY
  faq: {
    id: 'preguntas',
    title: 'Preguntas frecuentes',
    items: [
      {
        question: '¿Qué es un claim?',
        answer:
          'Es una venta en vivo: el vendedor publica sus piezas con precio en un horario y los compradores se las quedan con un toque. El primero en reclamar se la lleva, o puedes mandar una oferta y el vendedor decide.',
      },
      {
        question: '¿Cuánto cuesta?',
        answer:
          'Para compradores es gratis. Los vendedores pagan $50 MXN al mes (plan Básico, hasta 5 claims) o $100 MXN al mes (Pro, claims ilimitados). Tus primeros 3 claims son gratis, sin tarjeta.',
      },
      {
        question: '¿Cobran comisión por mis ventas?',
        answer:
          'No. Zlotify no cobra comisión por tus ventas. El dinero va directo del comprador al vendedor y nosotros solo llevamos el control.',
      },
      {
        question: '¿Zlotify maneja mi dinero?',
        answer:
          'No. Somos el escaparate, no el banco. Pagas por transferencia directo al vendedor y subes tu comprobante en Zlotify para que ambos tengan la cuenta clara.',
      },
      {
        question: '¿Cómo sé quién llegó primero?',
        answer:
          'El orden lo decide la hora del servidor, no la de tu celular, y es visible para todos. Si dos personas reclaman casi a la vez, el resultado es el mismo para todos y se ve quién ganó.',
      },
      {
        question: '¿Qué puedo vender?',
        answer:
          'Por ahora, cartas coleccionables y miniaturas. Estamos abriendo más categorías poco a poco: autos a escala, figuras, cómics, monedas y otras colecciones.',
      },
      {
        question: '¿Qué pasa si alguien no paga?',
        answer:
          'Si vence el plazo sin comprobante, el sistema lo marca como impago en su reputación, con referencia al claim. El comprador puede dejar una objeción que también se ve.',
      },
      {
        question: '¿Necesito descargar una app?',
        answer:
          'No. Entras desde el link que comparte el vendedor, en tu celular o tu computadora, sin instalar nada.',
      },
    ],
  },
  // TODO_COPY
  finalCta: {
    title: 'Que no se te pase el próximo claim',
    subtitle:
      'Crea tu cuenta gratis y entra a la sala cuando abra. Si vendes, tus primeros 3 claims van por nuestra cuenta.',
    cta: { label: 'Crear mi cuenta gratis', href: '/signup' },
    secondaryCta: { label: 'Ver planes', href: '#precios' },
    photo: photos.dragon,
  },
} as const;
