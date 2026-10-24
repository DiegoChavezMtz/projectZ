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
} as const;
