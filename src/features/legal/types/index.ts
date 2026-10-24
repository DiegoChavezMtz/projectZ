// Documentos legales de la plataforma (contenido placeholder hasta la revisión legal).
export type LegalSection = {
  heading: string;
  /** Párrafos en orden. */
  paragraphs: readonly string[];
  /** Lista opcional tras los párrafos. */
  items?: readonly string[];
};

export type LegalDocument = {
  title: string;
  description: string;
  /** Aviso visible de que el texto es provisional. */
  notice: string;
  sections: readonly LegalSection[];
};

export type LegalDocumentId = 'terms' | 'privacy';
