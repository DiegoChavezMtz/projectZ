// API pública de la feature 'auth'. Los services (server-only) solo se exponen como handlers de entrada.
export {
  SignupPage,
  LoginPage,
  VerifyEmailPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  TermsPage,
  SellerOnboardingPage,
} from './components/AuthPages';
export { AccountView } from './components/AccountView';
export { SecurityView } from './components/SecurityView';
export { SellerGate, SellerDashboardView } from './components/SellerGate';
export { SessionMenu } from './components/SessionMenu';
export { handleOAuthCallback } from './services/oauth.handler';
export { sanitizeNextPath } from './utils/nextPath';
export { isReservedHandle } from './utils/handle';
export { decideRoute } from './utils/routeGuard';
export { initialActionState } from './types';
export type { RouteDecision } from './utils/routeGuard';
export type { ActionState, CodePurpose } from './types';
