// Textos de correo (español de México). Sin strings sueltos en las plantillas.
export const emailContent = {
  brand: 'Zlotify',
  footer: {
    ignore: 'Si no solicitaste esto, ignora este correo.',
    privacy: 'Aviso de privacidad',
  },
  code: {
    validity: 'Este código vence en 10 minutos.',
  },
  verifyEmail: {
    subject: 'Tu código para verificar tu correo',
    greeting: (displayName: string) => `¡Hola, ${displayName}!`,
    body: 'Usa este código para verificar tu correo y terminar de crear tu cuenta en Zlotify.',
  },
  loginCode: {
    subject: 'Tu código para entrar',
    greeting: '¡Hola!',
    body: 'Usa este código para entrar a tu cuenta de Zlotify.',
  },
  resetPassword: {
    subject: 'Tu código para restablecer tu contraseña',
    greeting: '¡Hola!',
    body: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta de Zlotify. Usa este código para continuar.',
    warning: 'Si no fuiste tú, ignora este correo: tu contraseña no cambiará.',
  },
  changeEmail: {
    subject: 'Confirma tu nuevo correo',
    greeting: '¡Hola!',
    body: (newEmail: string) =>
      `Pediste usar ${newEmail} como el correo de tu cuenta de Zlotify. Usa este código para confirmarlo.`,
  },
  welcome: {
    subject: 'Bienvenido a Zlotify',
    greeting: (displayName: string) => `¡Hola, ${displayName}!`,
    body: 'Tu cuenta está lista. Ya puedes participar en los claims en vivo.',
    bodySeller:
      'Tu cuenta de vendedor está lista. Ya puedes preparar tu primer claim y compartir el enlace con tus compradores.',
    cta: 'Ir a Zlotify',
  },
  // --- Cumplimiento (S8). Un correo por acción relevante; tono claro y sin presión. ---
  fulfillment: {
    greeting: (displayName: string) => `¡Hola, ${displayName}!`,
    ctaBuyer: 'Ver mis cuentas',
    ctaSeller: 'Ir a las cuentas',
    orderReady: {
      subject: (shop: string) => `${shop} cerró tu cuenta`,
      body: (shop: string, reference: string, total: string, due: string) =>
        `${shop} cerró tu cuenta de «${reference}». El total es ${total}. Tienes hasta el ${due} para pagar y subir tu comprobante.`,
      hint: 'Si el vendedor lo habilitó, también puedes elegir el guardadito antes de enviar tu comprobante.',
    },
    paymentReview: {
      subject: (buyer: string) => `${buyer} subió un comprobante`,
      body: (buyer: string, reference: string) =>
        `${buyer} subió un comprobante de «${reference}». Revísalo y confírmalo o recházalo con un motivo.`,
    },
    paymentConfirmed: {
      subject: 'Tu pago fue confirmado',
      body: (shop: string, reference: string) =>
        `${shop} confirmó tu pago de «${reference}». Gracias.`,
      next: 'Te avisaremos cuando tu pedido esté en camino.',
    },
    paymentRejected: {
      subject: 'Tu comprobante necesita otra revisión',
      body: (shop: string, reference: string, reason: string) =>
        `${shop} no pudo confirmar tu comprobante de «${reference}». Motivo: ${reason}`,
      due: (due: string) => `Puedes subir otro comprobante hasta el ${due}.`,
    },
    paymentReminder: {
      subject: 'Tu pago vence pronto',
      body: (shop: string, reference: string, total: string, due: string) =>
        `Te recordamos que tu cuenta de «${reference}» con ${shop} (${total}) vence el ${due}. Si ya pagaste, sube tu comprobante.`,
    },
    unpaidNotice: {
      subjectBuyer: 'Tu cuenta venció sin pago',
      subjectSeller: (buyer: string) => `La cuenta de ${buyer} venció sin pago`,
      bodyBuyer: (shop: string, reference: string) =>
        `El plazo de tu cuenta de «${reference}» con ${shop} venció sin comprobante, así que quedó registrada como no pagada.`,
      objection:
        'Si crees que es un error, tienes 7 días para dejar una objeción desde tus cuentas. Se mostrará junto a la marca.',
      bodySeller: (buyer: string, reference: string) =>
        `El plazo de pago de ${buyer} en «${reference}» venció sin comprobante. Quedó registrada como no pagada.`,
    },
    deliveryRequested: {
      subject: (buyer: string) => `${buyer} solicitó su envío`,
      bodyShipping: (buyer: string, count: number) =>
        `${buyer} solicitó el envío de ${count === 1 ? 'una cuenta' : `${count} cuentas`}. Cotiza el costo de envío para que pueda pagarlo.`,
      bodyPickup: (buyer: string, count: number) =>
        `${buyer} pidió entrega en persona de ${count === 1 ? 'una cuenta' : `${count} cuentas`}. Coordina el punto y marca la entrega cuando la hagas.`,
    },
    deliveryQuoted: {
      subject: 'Ya está el costo de tu envío',
      body: (shop: string, shipping: string, due: string) =>
        `${shop} cotizó tu envío en ${shipping}. Paga y sube tu comprobante antes del ${due}.`,
    },
    deliveryShipped: {
      subjectShipping: 'Tu pedido va en camino',
      subjectPickup: 'Tu entrega en persona está lista',
      bodyShipping: (shop: string) => `${shop} envió tu pedido. Confirma cuando lo recibas.`,
      bodyPickup: (shop: string) =>
        `${shop} marcó tu pedido como entregado. Confirma cuando lo tengas.`,
      tracking: (code: string) => `Guía de rastreo: ${code}`,
    },
    deliveryReminder: {
      subject: 'Tienes un envío por hacer',
      body: (buyer: string, due: string) =>
        `El envío para ${buyer} debe salir antes del ${due}. Márcalo como enviado cuando lo hagas.`,
    },
    accumulateReminder: {
      subject: 'Tu guardadito vence en 7 días',
      body: (shop: string, count: number, until: string) =>
        `Tu guardadito con ${shop} (${count === 1 ? 'una cuenta' : `${count} cuentas`}) vence el ${until}. Cuando quieras, solicita tu envío desde tus cuentas.`,
    },
    accumulateNotice: {
      subject: 'Confirma el envío de tu guardadito',
      body: (shop: string, count: number, grace: string) =>
        `La vigencia de tu guardadito con ${shop} (${count === 1 ? 'una cuenta' : `${count} cuentas`}) terminó. Confirma tu envío antes del ${grace} para recibirlo.`,
      release:
        'Si no lo confirmas, las piezas vuelven al vendedor. Si no puedes recibirlas, también puedes liberarlas desde tus cuentas.',
    },
    accumulateReleased: {
      subject: 'Guardadito liberado',
      reasons: {
        grace_expired: 'no se confirmó el envío a tiempo',
        fee_unpaid: 'no se pagó el costo de envío a tiempo',
        buyer_request: 'el comprador lo pidió',
      },
      bodyBuyer: (shop: string, reason: string) =>
        `Tu guardadito con ${shop} se liberó porque ${reason}. Las piezas volvieron al vendedor. Zlotify no mueve dinero: cualquier reembolso o acuerdo es directo con el vendedor.`,
      bodySeller: (buyer: string, reason: string) =>
        `El guardadito de ${buyer} se liberó porque ${reason}. Las piezas volvieron a ti. Cualquier reembolso o acuerdo es directo con el comprador.`,
    },
  },
  reputation: {
    ratingReminder: {
      subject: 'Cuéntanos cómo te fue',
      body: (counterpart: string, reference: string, until: string) =>
        `Tu cuenta de «${reference}» con ${counterpart} ya se completó. Puedes calificarla hasta el ${until}; ayuda a que la comunidad compre y venda con confianza. Una vez enviada, la calificación no se edita.`,
      ctaBuyer: 'Calificar',
      ctaSeller: 'Calificar',
    },
  },
} as const;
