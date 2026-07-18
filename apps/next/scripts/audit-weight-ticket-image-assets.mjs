import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const { Pool } = pg
const WEIGHT_TICKET_BUCKET = 'weight-ticket-pdfs'

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
    const { data, error } = await supabase.storage.from(WEIGHT_TICKET_BUCKET).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`Storage list failed at ${prefix || '/'}: ${error.message}`)
    if (!data?.length) break

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id) objects.push(path)
      else objects.push(...await listObjectsRecursively(supabase, path))
    }

    if (data.length < pageSize) break
    offset += pageSize
  }

  return objects
}

function parseReference(rawValue) {
  if (typeof rawValue !== 'string') return { kind: 'invalid', storageKey: null }
  const value = rawValue.trim()
  if (!value) return { kind: 'empty', storageKey: null }
  if (value.startsWith('data:image/')) return { kind: 'dataUrl', storageKey: null }

  try {
    const parsed = JSON.parse(value)
    if (typeof parsed?.storageKey === 'string' && parsed.storageKey.trim()) {
      return { kind: 'storageKey', storageKey: parsed.storageKey.trim() }
    }
    if (typeof parsed?.url === 'string' && /^https?:\/\//.test(parsed.url)) {
      return { kind: 'publicUrl', storageKey: null }
    }
  } catch {
    // Legacy filename/pipe values are classified below without changing runtime behavior.
  }

  if (/^https?:\/\//.test(value)) return { kind: 'publicUrl', storageKey: null }
  if (value.includes('|')) return { kind: 'legacyUrl', storageKey: null }
  return { kind: 'filenameOnly', storageKey: null }
}

async function main() {
  const pool = new Pool({ connectionString: requiredEnv('DATABASE_URL') })
  const supabase = createClient(requiredEnv('NEXT_PUBLIC_SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const bucketResult = await pool.query(`
      select public, file_size_limit, allowed_mime_types
      from storage.buckets
      where id = $1
    `, [WEIGHT_TICKET_BUCKET])
    const result = await pool.query(`
      select
        id,
        doc_no,
        vehicle_image_names
      from public.weight_tickets
      order by doc_no asc
    `)
    const lineResult = await pool.query(`
      select
        weight_ticket_id,
        line_no,
        image_names
      from public.weight_ticket_lines
      order by weight_ticket_id asc, line_no asc
    `)
    const objects = await listObjectsRecursively(supabase)
    const objectSet = new Set(objects)
    const report = {
      allowedMimeTypes: bucketResult.rows[0]?.allowed_mime_types ?? null,
      bucket: WEIGHT_TICKET_BUCKET,
      bucketConfigured: Boolean(bucketResult.rows[0]),
      bucketPublic: bucketResult.rows[0]?.public ?? null,
      dataUrlRefs: 0,
      filenameOnlyRefs: 0,
      invalidRefs: 0,
      legacyUrlRefs: 0,
      missingStorageKeys: [],
      publicUrlRefs: 0,
      storageKeyRefs: 0,
      storageObjectCount: objects.length,
      storageFileSizeLimit: bucketResult.rows[0]?.file_size_limit ?? null,
      ticketCount: result.rows.length,
      vehicleReferenceCount: 0,
      lineReferenceCount: 0,
    }

    const addReference = (rawValue, owner) => {
      const parsed = parseReference(rawValue)
      if (parsed.kind === 'dataUrl') report.dataUrlRefs += 1
      if (parsed.kind === 'filenameOnly') report.filenameOnlyRefs += 1
      if (parsed.kind === 'invalid') report.invalidRefs += 1
      if (parsed.kind === 'legacyUrl') report.legacyUrlRefs += 1
      if (parsed.kind === 'publicUrl') report.publicUrlRefs += 1
      if (parsed.kind === 'storageKey') {
        report.storageKeyRefs += 1
        if (!objectSet.has(parsed.storageKey)) report.missingStorageKeys.push({ owner, storageKey: parsed.storageKey })
      }
    }

    for (const row of result.rows) {
      for (const image of row.vehicle_image_names ?? []) {
        report.vehicleReferenceCount += 1
        addReference(image, `${row.doc_no}:vehicle`)
      }
    }
    for (const row of lineResult.rows) {
      for (const image of row.image_names ?? []) {
        report.lineReferenceCount += 1
        addReference(image, `${row.weight_ticket_id}:line-${row.line_no}`)
      }
    }

    report.missingStorageKeys = report.missingStorageKeys.slice(0, 100)
    console.log(JSON.stringify(report, null, 2))
    if (report.missingStorageKeys.length || report.dataUrlRefs || report.invalidRefs) process.exitCode = 2
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
