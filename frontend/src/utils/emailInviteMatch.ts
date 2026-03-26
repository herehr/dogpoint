/** Same rules as backend `emailInviteMatch` (Gmail dots + plus tags). */
export function normEmail(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
}

export function canonicalEmailForInviteMatch(email: string): string {
  const n = normEmail(email)
  const at = n.lastIndexOf('@')
  if (at < 1) return n
  let local = n.slice(0, at)
  const domain = n.slice(at + 1)
  const dom = domain === 'googlemail.com' ? 'gmail.com' : domain
  if (dom !== 'gmail.com') return n
  const beforePlus = local.split('+')[0] ?? local
  const noDots = beforePlus.replace(/\./g, '')
  return `${noDots}@gmail.com`
}

export function emailsMatchForInvite(a: string, b: string): boolean {
  return canonicalEmailForInviteMatch(a) === canonicalEmailForInviteMatch(b)
}
