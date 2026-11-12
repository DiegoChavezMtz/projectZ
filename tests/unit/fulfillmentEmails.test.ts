import { describe, expect, it } from 'vitest';
import { renderEmail, sampleData, templateNames } from '@/lib/email/render';
import type { TemplateName } from '@/lib/email/types';

const appUrl = 'https://zlotify.test';

const fulfillmentTemplates: TemplateName[] = [
  'orderReady',
  'paymentReview',
  'paymentConfirmed',
  'paymentRejected',
  'paymentReminder',
  'unpaidNotice',
  'deliveryRequested',
  'deliveryQuoted',
  'deliveryShipped',
  'deliveryReminder',
  'accumulateReminder',
  'accumulateNotice',
  'accumulateReleased',
  'ratingReminder',
];

describe('plantillas de cumplimiento (S8-11)', () => {
  it('están registradas todas', () => {
    for (const name of fulfillmentTemplates) expect(templateNames).toContain(name);
  });

  it.each(fulfillmentTemplates)('%s: snapshot de asunto y texto', (template) => {
    const { subject, text } = renderEmail({ template, data: sampleData[template] }, { appUrl });
    expect({ subject, text }).toMatchSnapshot();
  });

  it('el comprador es dirigido a /orders y el vendedor a /dashboard/orders', () => {
    const buyer = renderEmail({ template: 'orderReady', data: sampleData.orderReady }, { appUrl });
    expect(buyer.html).toContain(`${appUrl}/orders`);
    const seller = renderEmail(
      { template: 'paymentReview', data: sampleData.paymentReview },
      { appUrl },
    );
    expect(seller.html).toContain(`${appUrl}/dashboard/orders`);
  });

  it('unpaidNotice: el comprador ve cómo objetar; el vendedor no', () => {
    const buyer = renderEmail(
      {
        template: 'unpaidNotice',
        data: { displayName: 'Luis', role: 'buyer', counterpartName: 'Tienda', reference: 'Claim' },
      },
      { appUrl },
    );
    const seller = renderEmail(
      {
        template: 'unpaidNotice',
        data: {
          displayName: 'Tienda',
          role: 'seller',
          counterpartName: 'Luis',
          reference: 'Claim',
        },
      },
      { appUrl },
    );
    expect(buyer.text).toContain('objeción');
    expect(seller.text).not.toContain('objeción');
  });

  it('escapa el HTML del motivo de rechazo que escribe el vendedor', () => {
    const { html } = renderEmail(
      {
        template: 'paymentRejected',
        data: { ...sampleData.paymentRejected, reason: '<script>alert(1)</script>' },
      },
      { appUrl },
    );
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });
});
