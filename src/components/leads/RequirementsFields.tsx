import { useData } from '@/contexts/DataContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RequirementsForm } from '@/lib/requirements';
import { cn } from '@/lib/utils';

interface Props {
  value: RequirementsForm;
  onChange: (next: RequirementsForm) => void;
  /** Field errors keyed like the server's: `requirements.budgetMax`. */
  errors?: Record<string, string>;
  idPrefix?: string;
}

const NONE = '__none__';

/** The client-requirements part of the lead form. Choices come from the admin-managed lists (lead-options API). */
export function RequirementsFields({ value, onChange, errors = {}, idPrefix = 'req' }: Props) {
  const { leadOptions } = useData();
  const set = <K extends keyof RequirementsForm>(key: K, v: RequirementsForm[K]) => onChange({ ...value, [key]: v });
  const toggle = (key: 'destinationIds' | 'propertyTypeIds', id: number) =>
    set(key, value[key].includes(id) ? value[key].filter((x) => x !== id) : [...value[key], id]);
  const err = (key: string) => errors[`requirements.${key}`] ?? errors[`requirements.${key.replace(/Ids$/, 's')}`];

  const chips = (key: 'destinationIds' | 'propertyTypeIds', label: string, list: typeof leadOptions.destinations) => (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {list.filter((o) => o.isActive || value[key].includes(o.id)).map((o) => {
          const on = value[key].includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              data-testid={`${idPrefix}-${key}-${o.id}`}
              onClick={() => toggle(key, o.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                on ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-500',
                !o.isActive && 'opacity-60'
              )}
              title={o.isActive ? undefined : 'No longer offered (kept because it was already selected)'}
            >
              {o.name}
            </button>
          );
        })}
        {!list.length && <span className="text-xs text-gray-500">No options yet - an administrator can add them.</span>}
      </div>
      {err(key) && <p className="text-xs text-red-600" role="alert">{err(key)}</p>}
    </fieldset>
  );

  const money = (key: 'budgetMin' | 'budgetMax' | 'downPayment' | 'installmentPerQuarter', label: string) => (
    <div className="space-y-1">
      <Label htmlFor={`${idPrefix}-${key}`}>{label}</Label>
      <Input
        id={`${idPrefix}-${key}`}
        inputMode="decimal"
        placeholder="EGP"
        value={value[key]}
        aria-invalid={Boolean(err(key))}
        onChange={(e) => set(key, e.target.value)}
      />
      {err(key) && <p className="text-xs text-red-600" role="alert">{err(key)}</p>}
    </div>
  );

  const choice = <K extends 'delivery' | 'finishing' | 'purpose'>(key: K, label: string, list: { value: string; label: string }[]) => (
    <div className="space-y-1">
      <Label htmlFor={`${idPrefix}-${key}`}>{label}</Label>
      <Select value={value[key] || NONE} onValueChange={(v) => set(key, (v === NONE ? '' : v) as RequirementsForm[K])}>
        <SelectTrigger id={`${idPrefix}-${key}`} aria-label={label}>
          <SelectValue placeholder="Not specified" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Not specified</SelectItem>
          {list.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {err(key) && <p className="text-xs text-red-600" role="alert">{err(key)}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      {chips('destinationIds', 'Destinations', leadOptions.destinations)}
      {chips('propertyTypeIds', 'Property types', leadOptions.propertyTypes)}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {money('budgetMin', 'Budget from')}
        {money('budgetMax', 'Budget to')}
        {money('downPayment', 'Down payment')}
        {money('installmentPerQuarter', 'Installment per quarter')}
        {choice('delivery', 'Delivery', leadOptions.delivery)}
        {choice('finishing', 'Finishing', leadOptions.finishing)}
        {choice('purpose', 'Purpose of purchase', leadOptions.purpose)}
      </div>
    </div>
  );
}
