import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isApiDocsEnabled } from '@/lib/api-docs'
import { ApiDocsClient } from './ApiDocsClient'

export const metadata: Metadata = {
  title: 'API Docs | NS Scrap ERP',
  description: 'Swagger API documentation for NS Scrap ERP',
}

export default function ApiDocsPage() {
  if (!isApiDocsEnabled()) {
    notFound()
  }

  return <ApiDocsClient />
}
