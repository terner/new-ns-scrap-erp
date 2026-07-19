import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const routeSource = readFileSync(new URL('./route.ts', import.meta.url), 'utf8')
const routeHandlers = new Set(['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'])

describe('cost pool route exports', () => {
  it('keeps reusable server functions outside the Next.js route module', () => {
    const exportedFunctions = [...routeSource.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)]
      .map((match) => match[1])

    expect(exportedFunctions.filter((name) => !routeHandlers.has(name))).toEqual([])
  })
})
