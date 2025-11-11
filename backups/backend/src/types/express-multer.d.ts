// Let Express's Request know multer adds .file / .files
import 'express'
import type { Multer } from 'multer'

declare global {
  namespace Express {
    // Single-file uploads
    interface Request {
      file?: Multer['File']
      files?: any
    }
  }
}

export {}