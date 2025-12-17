// backend/src/routes/posts.ts
import { Router } from 'express'
import {
  createPost,
  getPublicPosts,
  countNewPostsSince,
  updatePost,
  addPostMedia,     // NEW
  deletePostMedia,  // NEW
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

// Edit post – ADMIN always, MODERATOR only if still pending (enforced in controller)
router.patch(
  '/:id',
  checkAuth,
  [checkRole([Role.ADMIN, Role.MODERATOR])],
  updatePost
)

// ✅ MEDIA management (ADMIN only)
router.post(
  '/:id/media',
  checkAuth,
  [checkRole([Role.ADMIN])],
  addPostMedia
)

router.delete(
  '/:id/media/:mediaId',
  checkAuth,
  [checkRole([Role.ADMIN])],
  deletePostMedia
)

// Public posts for animal detail (no login needed)
router.get('/public', getPublicPosts)

// Optional helper endpoint – count new posts since timestamp
router.get('/count-new', countNewPostsSince)

export default router