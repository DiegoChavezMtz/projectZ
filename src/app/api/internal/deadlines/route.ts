import { handleDeadlinesRequest } from '@/features/fulfillment';

export function POST(request: Request) {
  return handleDeadlinesRequest(request);
}
