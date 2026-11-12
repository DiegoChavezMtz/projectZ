import type { Instrumentation } from 'next';

// Errores de servidor (render, route handlers, server actions) → logs estructurados + captura configurable.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { captureException } = await import('@/lib/observability/capture');
  await captureException(error, {
    route: request.path,
    context: { routeType: context.routeType, routePath: context.routePath, method: request.method },
  });
};
