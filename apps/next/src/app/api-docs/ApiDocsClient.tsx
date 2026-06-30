'use client'

import { ApiReferenceReact } from '@scalar/api-reference-react'

export function ApiDocsClient() {
  return (
    <div className="min-h-screen">
      <ApiReferenceReact
        configuration={{
          url: '/api/docs/openapi.yaml',
          hideDownloadButton: false,
          hideModels: false,
          persistAuth: true,
          theme: 'default',
        }}
      />
    </div>
  )
}
