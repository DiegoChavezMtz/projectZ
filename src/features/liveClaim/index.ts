// API pública de la feature 'liveClaim'. Las pages de `app/` usan las vistas de entrada y el servicio
// del calendario; los componentes de cliente nunca importan `snapshotService` (usa `server-only`).
export { LiveClaimPage, liveClaimMetadata } from './components/LiveClaimPage';
export { LiveListView } from './components/LiveListView';
export { calendarService } from './services/calendar.service';
export { claimActionsService } from './services/claimActions.service';
export { snapshotService } from './services/snapshot.service';
export type * from './types';
