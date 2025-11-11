import { Router } from 'express'
import { createSubscription, cancelSubscription, mySubscriptions, isMineSubscription } from '../controllers/subscriptionController'
import { checkAuth } from '../middleware/checkAuth' // you already have this

const r = Router()

r.post('/', checkAuth, createSubscription)
r.patch('/:id/cancel', checkAuth, cancelSubscription)
r.get('/mine', checkAuth, mySubscriptions)
r.get('/mine/:animalId/isMine', checkAuth, isMineSubscription)

export default r