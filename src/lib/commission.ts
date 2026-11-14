/** Default commission rule used when the admin leaves the field empty: 5,000 EGP per million of the deal amount. */
export const calculateCommission = (amount: number): number => {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor((amount / 1_000_000) * 5000);
};
