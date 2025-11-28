// backend/src/routes/posts.ts
import { Router } from 'express'
import { createPost, getPublicPosts, countNewPostsSince } from '../controllers/postController'
import { checkAuth } from '../middleware/checkAuth'
import { checkRole } from '../middleware/checkRole'
import { Role } from '@prisma/client'

const router = Router()

// Create new post – only ADMIN & MODERATOR
router.post(
  '/',
  checkAuth,
  [checkRole([Role.ADMIN, Role.MODERATOR])],
  createPost
)

// Public posts for animal detail (no login needed)
router.get('/public', getPublicPosts)

// Optional helper endpoint – count new posts since timestamp
router.get('/count-new', countNewPostsSince)

export default router