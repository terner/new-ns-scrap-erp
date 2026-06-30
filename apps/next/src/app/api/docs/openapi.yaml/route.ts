import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { isApiDocsEnabled } from '@/lib/api-docs'

export const dynamic = 'force-dynamic'

function resolveOpenApiPath() {
  const candidates = [
    path.resolve(process.cwd(), 'docs/api/openapi.yaml'),
    path.resolve(process.cwd(), '../../docs/api/openapi.yaml'),
  ]

  return candidates
}

export async function GET() {
  if (!isApiDocsEnabled()) {
    return new NextResponse('Not found', { status: 404 })
  }

  for (const candidate of resolveOpenApiPath()) {
    try {
      const yaml = await readFile(candidate, 'utf8')

      return new NextResponse(yaml, {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'application/yaml; charset=utf-8',
        },
      })
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code

      if (code !== 'ENOENT') {
        throw error
      }
    }
  }

  return NextResponse.json(
    { error: 'OpenAPI document not found' },
    { status: 500 },
  )
}
