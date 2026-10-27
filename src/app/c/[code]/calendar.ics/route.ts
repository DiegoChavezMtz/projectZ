import { calendarService } from '@/features/liveClaim';

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const file = await calendarService.getIcs((await params).code);
  if (!file) return new Response('No encontrado', { status: 404 });
  return new Response(file.body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'public, max-age=0, s-maxage=60',
    },
  });
}
