import { handleTelemetryRequest } from '@/lib/observability/telemetry';

export function POST(request: Request) {
  return handleTelemetryRequest(request);
}
