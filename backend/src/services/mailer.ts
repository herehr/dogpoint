// backend/src/services/mailer.ts
import { sendEmail } from './email'

export const mailer = {
  send: async (args: { to: string; subject: string; html: string; text?: string }) => {
    // your existing service sends HTML; text is optional
    await sendEmail(args.to, args.subject, args.html)
  },
}