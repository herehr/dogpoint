// backend/src/routes/adoptionRoutes.ts
import { Router } from 'express'
import { getAccess, getMe, startAdoption, endAdoption } from '../controllers/adoptionController'
import { myAdoptedAnimals, markAdoptionSeen } from '../controllers/adoptionExtraController'
import { checkAuth } from '../middleware/checkAuth' // or your requireAuth middleware

// use a unique const name
const adoptionRouter = Router()

adoptionRouter.get('/access/:animalId', getAccess)
adoptionRouter.get('/me', getMe)
adoptionRouter.post('/start', startAdoption)
adoptionRouter.post('/end', endAdoption)
// list my adopted animals (requires auth)
adoptionRouter.get('/my-animals', checkAuth, myAdoptedAnimals)

// mark animal as seen (requires auth)
adoptionRouter.post('/seen', checkAuth, markAdoptionSeen)

export default adoptionRouter