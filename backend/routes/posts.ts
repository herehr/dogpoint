// backend/src/routes/posts.ts
import { Router } from 'express'
import {
  createPost,
  getPublicPosts,
  countNewPostsSince,
  updatePost,
  addPostMedia,
  deletePostMedia,
} from '../controllers/postController'
import { checkAuth } from '../middleware/checkAuth'
import { checkRole } from '../middleware/checkRole'
import { Role } from '@prisma/client'

const router = Router()

// Create new post – ADMIN & MODERATOR
router.post('/', checkAuth, [checkRole([Role.ADMIN, Role.MODERATOR])], createPost)

// Edit post – ADMIN anytime, MODERATOR only if still pending (enforced in controller)
router.patch('/:id', checkAuth, [checkRole([Role.ADMIN, Role.MODERATOR])], updatePost)

// ✅ Add media to post — ADMIN only
router.post('/:id/media', checkAuth, [checkRole([Role.ADMIN])], addPostMedia)

// ✅ Delete ONE media item by mediaId — ADMIN only
router.delete('/media/:mediaId', checkAuth, [checkRole([Role.ADMIN])], deletePostMedia)

// Public posts for animal detail (no login needed)
router.get('/public', getPublicPosts)

// Optional helper endpoint – count new posts since timestamp
router.get('/count-new', countNewPostsSince)

export default router