// backend/src/routes/emailTest.ts
import { Router } from 'express';
import { sendEmail } from '../services/email';

const router = Router();

router.get('/test-email', async (_req, res) => {
  try {
    const info = await sendEmail(
      'dogpoint@pomaham.online', // 👈 your real address
      'Test Dogpoint Email',
      '<b>Hello!</b> This is a Dogpoint test email.'
    );

    return res.json({
      success: true,
      messageId: info.messageId,
    });
  } catch (err: any) {
    console.error('Email error (route):', err);

    return res.status(500).json({
      error: 'Email failed',
      // TEMPORARY: debug details – we will remove later
      message: err?.message,
      code: err?.code,
      command: err?.command,
      response: err?.response,
    });
  }
});

export default router;