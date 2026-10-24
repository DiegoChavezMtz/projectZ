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
  welcome: {
    subject: 'Bienvenido a Zlotify',
    greeting: (displayName: string) => `¡Hola, ${displayName}!`,
    body: 'Tu cuenta está lista. Ya puedes participar en los claims en vivo.',
    bodySeller:
      'Tu cuenta de vendedor está lista. Ya puedes preparar tu primer claim y compartir el enlace con tus compradores.',
    cta: 'Ir a Zlotify',
  },
} as const;
