// backend/src/middleware/rateLimiters.ts
import rateLimit, { type Options } from 'express-rate-limit'

const base: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
}

/** Login — anti brute-force (per IP). */
export const authLoginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many login attempts. Try again later.' },
})

/** Forgot / reset password — limit abuse and email spam. */
export const authPasswordEmailLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  max: 8,
  message: { error: 'Too many password-reset requests. Try again later.' },
})

export const authPasswordResetSubmitLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts. Try again later.' },
})

/** Other auth POSTs (register flows, set password, etc.). */
export const authPostGeneralLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { error: 'Too many requests. Try again later.' },
})

/** File upload — cost / abuse. */
export const uploadLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: { error: 'Too many uploads. Try again later.' },
})
