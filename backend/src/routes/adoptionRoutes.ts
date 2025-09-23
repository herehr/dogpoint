import { Router } from 'express'
import { getAccess, getMe, startAdoption, endAdoption } from '../controllers/adoptionController'

const r = Router()
// These endpoints match your frontend src/services/api.ts
r.get('/access/:animalId', getAccess)
r.get('/me', getMe)
r.post('/start', startAdoption)
r.post('/end', endAdoption)

export default r