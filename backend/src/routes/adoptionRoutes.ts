// backend/src/routes/adoptionRoutes.ts
import { Router } from 'express'
import { getAccess, getMe, startAdoption, endAdoption } from '../controllers/adoptionController'

// IMPORTANT: name the const something unique to avoid collisions
const adoptionRouter = Router()

// These endpoints match your frontend (frontend/src/services/api.ts)
adoptionRouter.get('/access/:animalId', getAccess)
adoptionRouter.get('/me', getMe)
adoptionRouter.post('/start', startAdoption)
adoptionRouter.post('/end', endAdoption)

export default adoptionRouter