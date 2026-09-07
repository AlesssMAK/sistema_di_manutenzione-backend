// Escape user-supplied text before feeding it to `new RegExp` / `$regex`,
// so a crafted pattern can't cause a ReDoS (catastrophic backtracking) or
// alter the intended search. Treats every regex metacharacter as a literal.
export const escapeRegex = (value = '') =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
