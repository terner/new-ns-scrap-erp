import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const { Pool } = pg
const PRODUCT_IMAGE_BUCKET = 'product-images'

function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required env: ${name}`)
  return value
}

async function listObjectsRecursively(supabase, prefix = '') {
  const objects = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`Storage list failed at ${prefix || '/'}: ${error.message}`)
    if (!data?.length) break

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id) {
        objects.push(path)
      } else {
        objects.push(...await listObjectsRecursively(supabase, path))
      }
    }

    if (data.length < pageSize) break
    offset += pageSize
  }

  return objects
}

function hasLegacyImageNames(value) {
  return Array.isArray(value) && value.some((item) => typeof item === 'string' && item.trim())
}

async function main() {
  const pool = new Pool({ connectionString: requiredEnv('DATABASE_URL') })
  const supabase = createClient(requiredEnv('NEXT_PUBLIC_SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const legacyColumnResult = await pool.query(`
      select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'products'
          and column_name = 'image_names'
      ) as present
    `)
    const legacyColumnPresent = Boolean(legacyColumnResult.rows[0]?.present)
    const result = await pool.query(`
      select id, code, ${legacyColumnPresent ? 'image_names,' : ''} image_storage_key, image_thumbnail_storage_key
      from public.products
      order by code asc
    `)
    const rows = result.rows
    const objects = await listObjectsRecursively(supabase)
    const objectSet = new Set(objects)
    const referencedKeys = new Set()
    const report = {
      productCount: rows.length,
      legacyColumnPresent,
      legacyImageRows: [],
      missingOriginalRows: [],
      missingThumbnailRows: [],
      orphanObjects: [],
      completeRows: 0,
      noImageRows: 0,
      partialStorageRows: [],
      storageObjectCount: objects.length,
    }

    for (const row of rows) {
      const originalKey = typeof row.image_storage_key === 'string' ? row.image_storage_key.trim() : ''
      const thumbnailKey = typeof row.image_thumbnail_storage_key === 'string' ? row.image_thumbnail_storage_key.trim() : ''
      if (originalKey) referencedKeys.add(originalKey)
      if (thumbnailKey) referencedKeys.add(thumbnailKey)
      const hasLegacyImage = legacyColumnPresent && hasLegacyImageNames(row.image_names)
      if (hasLegacyImage) report.legacyImageRows.push(row.code)
      if (!originalKey && !thumbnailKey && !hasLegacyImage) {
        report.noImageRows += 1
        continue
      }
      if (originalKey && !objectSet.has(originalKey)) report.missingOriginalRows.push(row.code)
      if (thumbnailKey && !objectSet.has(thumbnailKey)) report.missingThumbnailRows.push(row.code)
      if ((originalKey && !thumbnailKey) || (!originalKey && thumbnailKey)) report.partialStorageRows.push(row.code)
      if (originalKey && thumbnailKey && objectSet.has(originalKey) && objectSet.has(thumbnailKey)) report.completeRows += 1
    }

    report.orphanObjects = objects.filter((object) => !referencedKeys.has(object))
    console.log(JSON.stringify(report, null, 2))
    if (report.legacyImageRows.length || report.missingOriginalRows.length || report.missingThumbnailRows.length) {
      process.exitCode = 2
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
