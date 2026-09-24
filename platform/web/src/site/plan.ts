import type { Account } from './data/account';

export type ServicePlan = Account['billing']['plan'];

// Plan names and prices are enforced by the platform, not chosen for the page.
// They change when platform/crates/notary-api changes, never before.
const plans: Record<ServicePlan, { label: string; price: string }> = {
  free: { label: 'Free', price: '$0' },
  one_gb: { label: '1 GB', price: '$9.99 a month' },
  ten_gb: { label: '10 GB', price: '$49.99 a month' },
};

export function planLabel(plan: ServicePlan): string {
  return plans[plan]?.label ?? plan;
}

export function planPrice(plan: ServicePlan): string {
  return plans[plan]?.price ?? '';
}
