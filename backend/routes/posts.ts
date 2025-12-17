// backend/src/routes/posts.ts
import { Router } from 'express'
import {
  createPost,
  getPublicPosts,
  countNewPostsSince,
  updatePost, // NEW
} from '../controllers/postController'
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

// ✅ EDIT post – ADMIN always, MODERATOR only if still pending (enforced in controller)
router.patch(
  '/:id',
  checkAuth,
  [checkRole([Role.ADMIN, Role.MODERATOR])],
  updatePost
)

// Public posts for animal detail (no login needed)
router.get('/public', getPublicPosts)

// Optional helper endpoint – count new posts since timestamp
router.get('/count-new', countNewPostsSince)

export default router