import type { CallRecord } from '@/types';

const when = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};
const shown = (v: string | null | undefined) => v || <span className="text-gray-400">Not recorded</span>;

/**
 * What one saved call contains (used after Save, in Call History and in the lead timeline).
 * "Lead requirements at call time" is the read-only snapshot (Delivery / Finishing / Purpose) the server stored with the
 * call; the current values live on the lead and are edited only in Edit Lead.
 */
export function CallDetails({ call }: { call: CallRecord }) {
  const rows: [string, React.ReactNode][] = [
    ['Call', `#${call.id} - ${when(call.callAt)}`],
    ['Logged by', call.userName],
    [call.entityType === 'lead' ? 'Lead' : 'Cold call', call.entityName],
    ['Call outcome', shown(call.outcomeLabel)],
    ['Follow-up', call.followUpAt ? when(call.followUpAt) : <span className="text-gray-400">None</span>],
    ['Notes', call.notes ? <span className="whitespace-pre-wrap">{call.notes}</span> : <span className="text-gray-400">None</span>],
  ];
  const snapshot = call.entityType === 'lead'
    ? [call.deliveryLabel, call.finishingLabel, call.purposeLabel].some(Boolean)
      ? `${call.deliveryLabel ?? '-'} / ${call.finishingLabel ?? '-'} / ${call.purposeLabel ?? '-'}`
      : null
    : undefined;
  if (snapshot !== undefined) {
    rows.push(['Lead requirements at call time', snapshot ?? <span className="text-gray-400">Not recorded</span>]);
  }
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border p-4 text-sm sm:grid-cols-[180px_1fr]" data-testid="call-details">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-gray-500">{k}</dt>
          <dd className="font-medium text-gray-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
