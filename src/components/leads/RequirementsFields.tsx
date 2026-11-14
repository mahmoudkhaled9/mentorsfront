import { useData } from '@/contexts/DataContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { choiceLabel, type RequirementsForm } from '@/lib/requirements';
import { cn } from '@/lib/utils';

interface Props {
  value: RequirementsForm;
  onChange: (next: RequirementsForm) => void;
  /** Field errors keyed like the server's: `requirements.budgetMax`. */
  errors?: Record<string, string>;
  idPrefix?: string;
}


/** The client-requirements part of the lead form. Choices come from the admin-managed lists (lead-options API). */
export function RequirementsFields({ value, onChange, errors = {}, idPrefix = 'req' }: Props) {
  const { leadOptions, reload } = useData();
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

  // Only the business options are listed (no "Not specified" entry). An older lead may hold a value that is no longer
  // offered: it is shown, marked as old, but cannot be picked again. "Clear" removes the choice (these are optional here;
  // the Call Action requires them).
  const choice = <K extends 'delivery' | 'finishing' | 'purpose'>(key: K, label: string, list: { value: string; label: string }[]) => {
    const current = value[key];
    if (!list.length) {
      // the option lists come from the server (GET /api/lead-options). Never show an empty, dead dropdown.
      return (
        <div className="space-y-1">
          <Label>{label}</Label>
          <div role="alert" className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span className="flex-1">Options not available from the server{current ? ` (saved: ${choiceLabel([], current)})` : ''}.</span>
            <button type="button" className="font-medium underline" onClick={() => void reload(['leadOptions'])}>Retry</button>
          </div>
        </div>
      );
    }
    const legacy = current && !list.some((o) => o.value === current) ? current : '';
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor={`${idPrefix}-${key}`}>{label}</Label>
          {current && (
            <button type="button" className="text-xs text-gray-500 underline-offset-2 hover:underline" onClick={() => set(key, '' as RequirementsForm[K])}>
              Clear
            </button>
          )}
        </div>
        <Select value={current} onValueChange={(v) => set(key, v as RequirementsForm[K])}>
          <SelectTrigger id={`${idPrefix}-${key}`} className="w-full" aria-label={label}>
            <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {legacy && <SelectItem value={legacy} disabled>{choiceLabel([], legacy)}</SelectItem>}
            {list.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {err(key) && <p className="text-xs text-red-600" role="alert">{err(key)}</p>}
      </div>
    );
  };

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
