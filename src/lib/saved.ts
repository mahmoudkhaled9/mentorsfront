/**
 * The record a save returned, or null when the answer does not contain a usable one.
 * Current API: { ok, id, item }. Older backends answered with the bare row, { success, id } or { ok }. The screens
 * must never put `undefined` (or a raw database row) into their lists - that crashed the page into a white screen -
 * so when there is no proper `item` they reload the list from the server instead.
 */
export function savedItem<T extends { id: number }>(result: unknown): T | null {
  const item = (result as { item?: unknown } | null | undefined)?.item;
  if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'number') return item as T;
  return null;
}

/** The id the server reports for a create/update, whatever the response shape (null if none). */
export function savedId(result: unknown): number | null {
  const r = result as { id?: unknown; item?: { id?: unknown } } | null | undefined;
  const id = r?.item?.id ?? r?.id;
  return typeof id === 'number' && id > 0 ? id : typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : null;
}
