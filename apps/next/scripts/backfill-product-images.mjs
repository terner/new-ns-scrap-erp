import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const { Pool } = pg

const PRODUCT_IMAGE_BUCKET = 'product-images'
const PRODUCT_IMAGE_ORIGINAL_MAX_SIZE = 1600
const PRODUCT_IMAGE_THUMBNAIL_SIZE = 320
const DERIVED_IMAGE_EXTENSION = 'jpg'
const DERIVED_IMAGE_CONTENT_TYPE = 'image/jpeg'

function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required env: ${name}`)
  }
  return value
}

function sanitizeSegment(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'image'
}

function buildStorageKey(productCode, variant, fileName) {
  const normalizedCode = sanitizeSegment(productCode)
  const baseName = sanitizeSegment(fileName.replace(/\.[^.]+$/, ''))
  return `products/${normalizedCode}/${variant}/${Date.now()}-${baseName}.${DERIVED_IMAGE_EXTENSION}`
}

function parseStoredImage(rawValue) {
  const trimmed = String(rawValue ?? '').trim()
  if (!trimmed) {
    throw new Error('Empty legacy image payload')
  }

  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed.dataUrl !== 'string' || !parsed.dataUrl.startsWith('data:image/')) {
      throw new Error('Legacy image JSON does not contain dataUrl')
    }
    return {
      dataUrl: parsed.dataUrl,
      fileName: typeof parsed.fileName === 'string' && parsed.fileName.trim() ? parsed.fileName.trim() : 'legacy-image.jpg',
    }
  }

  if (trimmed.startsWith('data:image/')) {
    return {
      dataUrl: trimmed,
      fileName: 'legacy-image.jpg',
    }
  }

  throw new Error('Unsupported legacy image format')
}

function dataUrlToBuffer(dataUrl) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) {
    throw new Error('Invalid image dataUrl')
  }

  const mimeType = match[1]
  const base64 = match[2]
  const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
  return {
    buffer: Buffer.from(base64, 'base64'),
    extension,
  }
}

function runSips(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/sips', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`sips failed (${code}): ${stderr.trim()}`))
    })
  })
}

async function createDerivedImages(tempDir, fileName, inputBuffer, inputExtension) {
  const inputPath = path.join(tempDir, `source.${inputExtension}`)
  const originalPath = path.join(tempDir, `original.${DERIVED_IMAGE_EXTENSION}`)
  const thumbPath = path.join(tempDir, `thumb.${DERIVED_IMAGE_EXTENSION}`)

  await writeFile(inputPath, inputBuffer)
  await runSips(['-Z', String(PRODUCT_IMAGE_ORIGINAL_MAX_SIZE), '-s', 'format', 'jpeg', inputPath, '--out', originalPath])
  await runSips(['-Z', String(PRODUCT_IMAGE_THUMBNAIL_SIZE), '-s', 'format', 'jpeg', inputPath, '--out', thumbPath])

  const [originalBuffer, thumbBuffer] = await Promise.all([
    readFile(originalPath),
    readFile(thumbPath),
  ])

  return {
    fileName,
    originalBuffer,
    thumbBuffer,
  }
}

async function main() {
  const databaseUrl = requiredEnv('DATABASE_URL')
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')

  const pool = new Pool({ connectionString: databaseUrl })
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const uploadedRows = []
  const failures = []

  try {
    const result = await pool.query(`
      select id, code, image_names, image_storage_key, image_thumbnail_storage_key
      from public.products
      where coalesce(array_length(image_names, 1), 0) > 0
        and (image_storage_key is null or image_thumbnail_storage_key is null)
      order by code asc
    `)

    console.log(`Found ${result.rowCount} products needing image backfill`)

    for (const row of result.rows) {
      const uploadedKeys = []
      const tempDir = await mkdtemp(path.join(os.tmpdir(), `product-image-backfill-${row.code}-`))

      try {
        const firstImage = row.image_names?.[0]
        const parsed = parseStoredImage(firstImage)
        const { buffer, extension } = dataUrlToBuffer(parsed.dataUrl)
        const derived = await createDerivedImages(tempDir, parsed.fileName, buffer, extension)

        const originalKey = row.image_storage_key || buildStorageKey(row.code, 'original', derived.fileName)
        const thumbKey = row.image_thumbnail_storage_key || buildStorageKey(row.code, 'thumb', derived.fileName)

        if (!row.image_storage_key) {
          const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(originalKey, derived.originalBuffer, {
            cacheControl: '3600',
            contentType: DERIVED_IMAGE_CONTENT_TYPE,
            upsert: true,
          })
          if (error) throw new Error(`original upload failed: ${error.message}`)
          uploadedKeys.push(originalKey)
        }

        if (!row.image_thumbnail_storage_key) {
          const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(thumbKey, derived.thumbBuffer, {
            cacheControl: '3600',
            contentType: DERIVED_IMAGE_CONTENT_TYPE,
            upsert: true,
          })
          if (error) throw new Error(`thumb upload failed: ${error.message}`)
          uploadedKeys.push(thumbKey)
        }

        await pool.query(
          `
            update public.products
            set image_storage_key = $1,
                image_thumbnail_storage_key = $2,
                updated_at = now()
            where id = $3
          `,
          [originalKey, thumbKey, row.id],
        )

        uploadedRows.push({ code: row.code, originalKey, thumbKey })
        console.log(`Backfilled ${row.code}`)
      } catch (error) {
        failures.push({ code: row.code, error: error instanceof Error ? error.message : String(error) })
        if (uploadedKeys.length > 0) {
          await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove(uploadedKeys).catch(() => undefined)
        }
        console.error(`Failed ${row.code}: ${failures.at(-1)?.error}`)
      } finally {
        await rm(tempDir, { force: true, recursive: true }).catch(() => undefined)
      }
    }

    console.log(`Completed. success=${uploadedRows.length} failed=${failures.length}`)
    if (failures.length > 0) {
      console.log(JSON.stringify({ failures }, null, 2))
      process.exitCode = 1
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
