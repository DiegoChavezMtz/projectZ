import { ReadingLayout } from '@/components/templates/ReadingLayout';
import { legalContent } from '../../content/es-MX';
import type { LegalDocumentId } from '../../types';

/** Documento legal en layout de lectura. Server component sin estado. */
export function LegalDocument({ id }: { id: LegalDocumentId }) {
  const doc = legalContent[id];
  return (
    <ReadingLayout title={doc.title} updated={doc.notice}>
      {doc.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.items ? (
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </ReadingLayout>
  );
}
