// backend/src/routes/adoptionRoutes.ts
import { Router } from 'express'
import { getAccess, getMe, startAdoption, endAdoption } from '../controllers/adoptionController'

// use a unique const name
const adoptionRouter = Router()

adoptionRouter.get('/access/:animalId', getAccess)
adoptionRouter.get('/me', getMe)
adoptionRouter.post('/start', startAdoption)
adoptionRouter.post('/end', endAdoption)

export default adoptionRouter