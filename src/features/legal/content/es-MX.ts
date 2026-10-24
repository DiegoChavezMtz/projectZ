import type { LegalDocument, LegalDocumentId } from '../types';

const notice =
  'Texto provisional. El contenido definitivo lo redacta y aprueba el equipo legal antes del lanzamiento.';

// Las secciones técnicas obligatorias (docs/sprints/03-auth-complete.md, S3-13) deben conservarse en el texto final:
// comprobantes, dirección, publicación de historial de cumplimiento y marcas de impago con objeciones,
// y conservación de datos tras eliminar la cuenta.
const terms: LegalDocument = {
  title: 'Términos y condiciones',
  description: 'Reglas para usar Zlotify como comprador y como vendedor.',
  notice,
  sections: [
    {
      heading: 'Qué es Zlotify',
      paragraphs: [
        'Zlotify es una plataforma donde vendedores publican artículos en eventos en vivo y compradores los reclaman. Zlotify no es parte de la compraventa: la entrega y el pago ocurren entre comprador y vendedor.',
      ],
    },
    {
      heading: 'Tu cuenta',
      paragraphs: [
        'Debes dar un correo válido y mantener tu cuenta segura. Eres responsable de lo que ocurra con tu sesión.',
      ],
    },
    {
      heading: 'Claims, pagos y entregas',
      paragraphs: [
        'Un claim ganado te obliga a pagar el artículo dentro del plazo del evento. El vendedor se obliga a entregar lo pagado en su plazo.',
      ],
    },
    {
      heading: 'Comprobantes de pago',
      paragraphs: [
        'Puedes subir comprobantes de pago como evidencia. Solo el comprador y el vendedor de esa cuenta pueden verlos, y se usan únicamente para validar el pago.',
      ],
    },
    {
      heading: 'Historial de cumplimiento y marcas de impago',
      paragraphs: [
        'Zlotify publica en tu perfil público estadísticas de cumplimiento: pagos a tiempo, entregas y calificaciones.',
        'Cuando vence el plazo de pago sin comprobante, el sistema registra una marca de impago visible en tu historial. Puedes agregar una objeción que se mostrará junto a esa marca.',
      ],
    },
    {
      heading: 'Eliminación de tu cuenta',
      paragraphs: [
        'Puedes eliminar tu cuenta si no tienes eventos, pagos o entregas en curso. Tus datos personales se anonimizan; el historial que involucra a otras personas se conserva sin identificarte.',
      ],
    },
  ],
};

const privacy: LegalDocument = {
  title: 'Política de privacidad',
  description: 'Qué datos recopila Zlotify, para qué los usa y cómo los protege.',
  notice,
  sections: [
    {
      heading: 'Datos que recopilamos',
      paragraphs: ['Recopilamos solo lo necesario para operar la plataforma:'],
      items: [
        'Correo, nombre para mostrar, nombre de usuario y foto de perfil.',
        'Datos de inicio de sesión, incluido Google si eliges entrar con tu cuenta de Google.',
        'Actividad en los claims, cuentas, pagos y entregas.',
      ],
    },
    {
      heading: 'Comprobantes de pago',
      paragraphs: [
        'Los comprobantes que subes se almacenan de forma privada y solo son accesibles para las dos partes de la cuenta.',
      ],
    },
    {
      heading: 'Datos de dirección',
      paragraphs: [
        'Si eliges envío, tu dirección se comparte únicamente con el vendedor de esa entrega y solo mientras sea necesaria para completarla.',
      ],
    },
    {
      heading: 'Publicación de historial de cumplimiento y marcas de impago',
      paragraphs: [
        'Tu perfil público muestra estadísticas de cumplimiento y, en su caso, marcas de impago con las objeciones que hayas escrito. Es información pública porque da confianza a la comunidad.',
      ],
    },
    {
      heading: 'Conservación tras eliminar tu cuenta',
      paragraphs: [
        'Al eliminar tu cuenta anonimizamos tu perfil (nombre, usuario y foto). Conservamos de forma anónima los registros de cuentas, entregas y reputación que involucran a otras personas, por integridad de sus datos.',
      ],
    },
    {
      heading: 'Correo y seguridad',
      paragraphs: [
        'Enviamos correos transaccionales (códigos y avisos de tu cuenta). Nunca te pediremos tu contraseña por correo.',
      ],
    },
  ],
};

export const legalContent: Record<LegalDocumentId, LegalDocument> = { terms, privacy };
