'use client'

import { useEffect } from 'react'

const PAGE_TITLE_EVENT = 'ns-scrap-erp-page-title'

type PageTitleOverrideProps = {
  breadcrumbLabel?: string
  title: string
}

export function PageTitleOverride({ breadcrumbLabel, title }: PageTitleOverrideProps) {
  useEffect(() => {
    const detail = { breadcrumbLabel, title }
    window.dispatchEvent(new CustomEvent(PAGE_TITLE_EVENT, { detail }))
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(PAGE_TITLE_EVENT, { detail }))
    }, 0)

    return () => {
      window.clearTimeout(timer)
      window.dispatchEvent(new CustomEvent(PAGE_TITLE_EVENT, { detail: { breadcrumbLabel: null, title: null } }))
    }
  }, [breadcrumbLabel, title])

  return null
}
