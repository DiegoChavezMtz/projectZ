// API pública de la feature 'fulfillment'. Solo lo que otros módulos necesitan.
export { OrderDetailView } from './components/OrderDetailView';
export { PaymentInstructionsView } from './components/PaymentInstructionsView';
export { OrdersListView } from './components/OrdersListView';
export { SellerOrdersView } from './components/SellerOrdersView';
export { handleDeadlinesRequest } from './services/deadlines.handler';
export type * from './types';
