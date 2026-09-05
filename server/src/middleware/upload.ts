import multer from 'multer'
import path from 'path'
import { Request } from 'express'

const storage = multer.memoryStorage()

function fileFilter(
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  const allowedMimeTypes = ['text/plain', 'application/octet-stream']
  const allowedExtensions = ['.log', '.txt']

  // Get only the last extension — prevents virus.exe.txt tricks
  const ext = path.extname(file.originalname).toLowerCase()

  // Both must pass — extension AND mime type
  const validExtension = allowedExtensions.includes(ext)
  const validMimeType = allowedMimeTypes.includes(file.mimetype)

  if (validExtension && validMimeType) {
    cb(null, true)
  } else {
    cb(new Error('Only .log and .txt files are allowed'))
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
})