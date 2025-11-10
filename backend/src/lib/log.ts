// backend/src/lib/log.ts
export function logErr(tag: string, e: any) {
  const msg = e?.message ?? String(e)
  const stack = e?.stack ?? ''
  console.error(`[${tag}]`, msg)
  if (stack) console.error(stack)
}