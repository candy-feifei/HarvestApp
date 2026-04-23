import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'
import { diskStorage } from 'multer'
import { existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

const receiptsDir = () => {
  const dir = join(process.cwd(), 'uploads', 'receipts')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

const allowedExt = /^\.(jpe?g|png|gif|webp|pdf)$/i

@Controller('uploads')
@ApiTags('uploads')
@ApiBearerAuth()
export class UploadsController {
  @Post('receipt')
  @ApiOperation({
    summary: 'Upload expense receipt (image or PDF, max 8MB)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          try {
            cb(null, receiptsDir())
          } catch (e) {
            cb(e as Error, '')
          }
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname)
          const safe = ext && ext.length <= 8 && allowedExt.test(ext) ? ext : '.bin'
          cb(null, `${randomUUID()}${safe}`)
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('Please select a file to upload')
    }
    const allowed =
      ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(
        file.mimetype,
      ) || file.mimetype === 'application/pdf'
    if (!allowed) {
      try {
        unlinkSync(file.path)
      } catch {
        /* empty */
      }
      throw new BadRequestException(
        'Only images (JPEG, PNG, GIF, WebP) or PDF are allowed',
      )
    }
    return { receiptUrl: `/api/uploads/receipts/${file.filename}` as const }
  }
}
