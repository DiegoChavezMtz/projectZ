// API pública de la feature 'auth'. No exporta services (server-only): las pages usan los componentes de entrada.
export { SignupPage, LoginPage, VerifyEmailPage } from './components/AuthPages';
export { AccountView } from './components/AccountView';
export { SessionMenu } from './components/SessionMenu';
export { sanitizeNextPath } from './utils/nextPath';
export { isReservedHandle } from './utils/handle';
export { decideRoute } from './utils/routeGuard';
export { initialActionState } from './types';
export type { RouteDecision } from './utils/routeGuard';
export type { ActionState, CodePurpose } from './types';
