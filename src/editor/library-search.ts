/** Search semantic labels, hints and categories together, independent of the active tab. */
export function matchesLibrary(query: string, ...values: string[]) {
  const haystack = values.join(" ").toLocaleLowerCase();
  return query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
}
