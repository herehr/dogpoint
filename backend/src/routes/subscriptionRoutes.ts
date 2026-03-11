import { Router } from 'express'
import {
  createSubscription,
  cancelSubscription,
  mySubscriptions,
  isMineSubscription,
  listGiftRecipients,
  addGiftRecipient,
  removeGiftRecipient,
} from '../controllers/subscriptionController'
import { checkAuth } from '../middleware/checkAuth'

const r = Router()

r.post('/', checkAuth, createSubscription)
r.patch('/:id/cancel', checkAuth, cancelSubscription)
r.get('/mine', checkAuth, mySubscriptions)
r.get('/mine/:animalId/isMine', checkAuth, isMineSubscription)

r.get('/:id/gift-recipients', checkAuth, listGiftRecipients)
r.post('/:id/gift-recipients', checkAuth, addGiftRecipient)
r.delete('/:id/gift-recipients/:recipientId', checkAuth, removeGiftRecipient)

export default r