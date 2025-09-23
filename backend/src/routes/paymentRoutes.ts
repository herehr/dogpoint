// backend/src/routes/paymentRoutes.ts
import { Router } from 'express'
import { createCheckoutSession } from '../controllers/stripe'

const paymentRouter = Router()
paymentRouter.post('/stripe/checkout', createCheckoutSession)

export default paymentRouter