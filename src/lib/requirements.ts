import type { DeliveryOption, FinishingOption, LeadOptions, LeadRequirements, PurposeOption } from '@/types';

export const emptyRequirements = (): LeadRequirements => ({
  destinationIds: [], propertyTypeIds: [], budgetMin: null, budgetMax: null, delivery: null,
  finishing: null, downPayment: null, installmentPerQuarter: null, purpose: null,
});

/** Text inputs of the requirements form (numbers are edited as text so "1,500,000" can be typed). */
export interface RequirementsForm {
  destinationIds: number[];
  propertyTypeIds: number[];
  budgetMin: string;
  budgetMax: string;
  delivery: DeliveryOption | '';
  finishing: FinishingOption | '';
  downPayment: string;
  installmentPerQuarter: string;
  purpose: PurposeOption | '';
}

const numText = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

export const toRequirementsForm = (r?: LeadRequirements | null): RequirementsForm => {
  const v = r ?? emptyRequirements();
  return {
    destinationIds: [...v.destinationIds], propertyTypeIds: [...v.propertyTypeIds],
    budgetMin: numText(v.budgetMin), budgetMax: numText(v.budgetMax), delivery: v.delivery ?? '', finishing: v.finishing ?? '',
    downPayment: numText(v.downPayment), installmentPerQuarter: numText(v.installmentPerQuarter), purpose: v.purpose ?? '',
  };
};

/** Parses an amount typed by a person ("1,500,000", "2.5m" is NOT accepted). '' -> null. */
export function parseAmount(text: string): number | null | 'invalid' {
  const t = text.replace(/[,\s]/g, '').trim();
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return 'invalid';
  const n = Number(t);
  return n > 999999999999 ? 'invalid' : n;
}

/** Validates the form. Returns the API value, or field errors keyed like the server's (`requirements.budgetMax`). */
export function fromRequirementsForm(form: RequirementsForm): { value: LeadRequirements; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const amount = (key: 'budgetMin' | 'budgetMax' | 'downPayment' | 'installmentPerQuarter', label: string) => {
    const n = parseAmount(form[key]);
    if (n === 'invalid') { errors[`requirements.${key}`] = `${label} must be a positive number`; return null; }
    return n;
  };
  const value: LeadRequirements = {
    destinationIds: form.destinationIds,
    propertyTypeIds: form.propertyTypeIds,
    budgetMin: amount('budgetMin', 'Minimum budget'),
    budgetMax: amount('budgetMax', 'Maximum budget'),
    delivery: form.delivery || null,
    finishing: form.finishing || null,
    downPayment: amount('downPayment', 'Down payment'),
    installmentPerQuarter: amount('installmentPerQuarter', 'Quarterly installment'),
    purpose: form.purpose || null,
  };
  if (value.budgetMin !== null && value.budgetMax !== null && value.budgetMin > value.budgetMax) {
    errors['requirements.budgetMax'] = 'Maximum budget must be at least the minimum budget';
  }
  if (value.downPayment !== null && value.budgetMax !== null && value.downPayment > value.budgetMax) {
    errors['requirements.downPayment'] = 'Down payment cannot be higher than the maximum budget';
  }
  return { value, errors };
}

/** Labels of choices that are no longer offered but may still be stored on older leads. */
export const LEGACY_CHOICE_LABELS: Record<string, string> = {
  personal_living: 'Personal Living (old option)',
  upgrading: 'Upgrading (old option)',
};

/** Label of a stored choice value (falls back to the old-option label, then the raw value). */
export const choiceLabel = (list: { value: string; label: string }[], value: string | null | undefined) =>
  value ? list.find((o) => o.value === value)?.label ?? LEGACY_CHOICE_LABELS[value] ?? value : '';

export const formatMoney = (n: number | null | undefined) => (n === null || n === undefined ? '' : `${Number(n).toLocaleString('en-US')} EGP`);

export function budgetText(r?: LeadRequirements | null) {
  if (!r || (r.budgetMin === null && r.budgetMax === null)) return '';
  if (r.budgetMin !== null && r.budgetMax !== null) return `${formatMoney(r.budgetMin)} – ${formatMoney(r.budgetMax)}`;
  return r.budgetMin !== null ? `from ${formatMoney(r.budgetMin)}` : `up to ${formatMoney(r.budgetMax)}`;
}

/** Short one-line summary for tables: "New Cairo, North Coast · 3 Bedrooms · up to 5,000,000 EGP". */
export function requirementsSummary(r: LeadRequirements | undefined | null, options: LeadOptions) {
  if (!r) return '';
  const names = (ids: number[], list: { id: number; name: string }[]) => ids.map((id) => list.find((o) => o.id === id)?.name).filter(Boolean).join(', ');
  return [names(r.destinationIds, options.destinations), names(r.propertyTypeIds, options.propertyTypes), budgetText(r), choiceLabel(options.purpose, r.purpose)]
    .filter(Boolean).join(' · ');
}

export interface RequirementFilters {
  destinationId: string;
  propertyTypeId: string;
  purpose: string;
  delivery: string;
  finishing: string;
  budget: string;
}

export const emptyRequirementFilters = (): RequirementFilters => ({ destinationId: 'all', propertyTypeId: 'all', purpose: 'all', delivery: 'all', finishing: 'all', budget: '' });

export const hasRequirementFilters = (f: RequirementFilters) =>
  f.destinationId !== 'all' || f.propertyTypeId !== 'all' || f.purpose !== 'all' || f.delivery !== 'all' || f.finishing !== 'all' || f.budget.trim() !== '';

/** Same rules as the server-side filters of GET /api/leads (the budget must fall inside the client's range). */
export function matchesRequirementFilters(r: LeadRequirements | undefined | null, f: RequirementFilters): boolean {
  if (!hasRequirementFilters(f)) return true;
  const req = r ?? emptyRequirements();
  if (f.destinationId !== 'all' && !req.destinationIds.includes(Number(f.destinationId))) return false;
  if (f.propertyTypeId !== 'all' && !req.propertyTypeIds.includes(Number(f.propertyTypeId))) return false;
  if (f.purpose !== 'all' && req.purpose !== f.purpose) return false;
  if (f.delivery !== 'all' && req.delivery !== f.delivery) return false;
  if (f.finishing !== 'all' && req.finishing !== f.finishing) return false;
  const budget = parseAmount(f.budget);
  if (typeof budget === 'number') {
    if (req.budgetMin === null && req.budgetMax === null) return false;
    if (req.budgetMin !== null && req.budgetMin > budget) return false;
    if (req.budgetMax !== null && req.budgetMax < budget) return false;
  }
  return true;
}
