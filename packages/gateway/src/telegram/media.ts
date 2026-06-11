import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'

import { InputFile } from 'grammy'

import type { MessageContent } from '@siya/sdk'
import type { Api, Context } from 'grammy'

const IMAGE_MIME_PREFIX = 'image/'
const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024

export type ExtractedTelegramMedia = {
  content: MessageContent[]
  promptText: string
  savedFiles: string[]
}

async function downloadTelegramFile(
  api: Api,
  botToken: string,
  fileId: string,
): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const file = await api.getFile(fileId)
  if (!file.file_path) {
    throw new Error('Telegram file path unavailable')
  }

  const url = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download Telegram file (${response.status})`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error('File is too large (max 10 MB)')
  }

  const fileName = path.basename(file.file_path)
  const mimeType =
    response.headers.get('content-type') ?? 'application/octet-stream'

  return { buffer, mimeType, fileName }
}

async function saveToUploadsDir(
  buffer: Buffer,
  fileName: string,
  projectCwd: string,
): Promise<string> {
  const uploadsDir = path.join(projectCwd, '.siya', 'telegram-uploads')
  await fsPromises.mkdir(uploadsDir, { recursive: true })

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const targetPath = path.join(uploadsDir, `${Date.now()}-${safeName}`)
  await fsPromises.writeFile(targetPath, buffer)
  return targetPath
}

export async function extractMediaFromMessage(params: {
  ctx: Context
  botToken: string
  projectCwd: string
  fallbackPrompt: string
}): Promise<ExtractedTelegramMedia> {
  const { ctx, botToken, projectCwd, fallbackPrompt } = params
  const message = ctx.message
  if (!message) {
    return { content: [], promptText: fallbackPrompt, savedFiles: [] }
  }

  const caption = message.caption?.trim() ?? ''
  const promptText =
    caption || fallbackPrompt || 'Describe and use the attached image.'
  const content: MessageContent[] = []
  const savedFiles: string[] = []

  if (message.photo?.length) {
    const largest = message.photo[message.photo.length - 1]
    const { buffer, mimeType } = await downloadTelegramFile(
      ctx.api,
      botToken,
      largest.file_id,
    )
    const mediaType = mimeType.startsWith(IMAGE_MIME_PREFIX)
      ? mimeType
      : 'image/jpeg'

    content.push({
      type: 'image',
      image: buffer.toString('base64'),
      mediaType,
    })

    const savedPath = await saveToUploadsDir(
      buffer,
      'telegram-photo.jpg',
      projectCwd,
    )
    savedFiles.push(savedPath)

    return { content, promptText, savedFiles }
  }

  if (message.document) {
    const doc = message.document
    const { buffer, mimeType, fileName } = await downloadTelegramFile(
      ctx.api,
      botToken,
      doc.file_id,
    )

    if (
      mimeType.startsWith(IMAGE_MIME_PREFIX) ||
      fileName.match(/\.(png|jpe?g|gif|webp)$/i)
    ) {
      content.push({
        type: 'image',
        image: buffer.toString('base64'),
        mediaType: mimeType.startsWith(IMAGE_MIME_PREFIX)
          ? mimeType
          : 'image/png',
      })
    }

    const savedPath = await saveToUploadsDir(buffer, fileName, projectCwd)
    savedFiles.push(savedPath)

    const filePrompt =
      promptText +
      (content.length === 0
        ? `\n\n[User attached file saved at: ${savedPath}]`
        : `\n\n[Image also saved at: ${savedPath}]`)

    return { content, promptText: filePrompt, savedFiles }
  }

  return { content, promptText, savedFiles }
}

export async function sendImageIfExists(
  api: Api,
  chatId: string,
  filePath: string,
  caption?: string,
): Promise<boolean> {
  if (!fs.existsSync(filePath)) {
    return false
  }

  if (!filePath.match(/\.(png|jpe?g|gif|webp)$/i)) {
    return false
  }

  await api.sendPhoto(chatId, new InputFile(filePath), {
    caption: caption?.slice(0, 1024),
  })
  return true
}
