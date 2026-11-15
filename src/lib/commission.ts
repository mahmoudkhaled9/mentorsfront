/**
 * Commission rule: 5,000 EGP for every 1,000,000 EGP of the deal value (0.5%): 5M -> 25,000, 10M -> 50,000 - for deals
 * sold by an AGENT only (team leaders, supervisors, managers, directors, franchise owners and admins earn none).
 * The SERVER calculates and stores it on every save (yourmentorsapp/src/domain/commission.js); this copy only shows the
 * same figure in the Add Deal form before saving. Rounded to the piastre, exactly like the server.
 */
export const COMMISSION_PER_MILLION = 5000;

export const earnsCommission = (role: string | undefined | null): boolean =>
  typeof role === 'string' && role.trim().toLowerCase().replace(/[\s-]+/g, '_') === 'agent';

export const calculateCommission = (amount: number, sellerRole: string | undefined | null): number => {
  if (!earnsCommission(sellerRole)) return 0;
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(((amount * COMMISSION_PER_MILLION) / 1_000_000) * 100) / 100;
};
