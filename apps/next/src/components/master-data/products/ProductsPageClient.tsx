'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { ActiveToggle } from '@/components/ui/ActiveToggle'
import { getErrorMessage } from '@/lib/api-client'
import { listMasterDataRecords, type MasterDataRecord } from '@/lib/master-data'
import {
  buildProductOriginalImageStorageKey,
  buildProductThumbnailStorageKey,
  prepareProductImageUploadAssets,
  PRODUCT_IMAGE_BUCKET,
} from '@/lib/product-images'
import {
  exportProducts,
  importProducts,
  listProducts,
  productFormSchema,
  saveProduct,
  setProductActive,
  type Product,
  type ProductFormValues,
} from '@/lib/product'
import { getSupabaseClient } from '@/lib/supabase'

type SortKey = 'active' | 'code' | 'name' | 'type' | 'unit'

const emptyProductForm: ProductFormValues = {
  id: undefined,
  code: null,
  name: '',
  active: true,
  imageStorageKey: null,
  imageThumbnailStorageKey: null,
  type: null,
  unit: 'กก.',
}

function productToForm(product: Product): ProductFormValues {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    active: product.active,
    imageStorageKey: product.imageStorageKey,
    imageThumbnailStorageKey: product.imageThumbnailStorageKey,
    type: product.type,
    unit: product.unit ?? 'กก.',
  }
}

function displayValue(value: string | number | null) {
  return value === null || value === '' ? '-' : value
}

function uniqueText(values: Array<string | null>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, 'th', { numeric: true }))
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`อ่านไฟล์ ${file.name} ไม่สำเร็จ`))
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.readAsDataURL(file)
  })
}

function compareProducts(left: Product, right: Product, key: SortKey, direction: 'asc' | 'desc') {
  const multiplier = direction === 'asc' ? 1 : -1
  const leftValue = left[key]
  const rightValue = right[key]

  if (typeof leftValue === 'number' || typeof rightValue === 'number') {
    return (((leftValue as number | null) ?? -Infinity) - ((rightValue as number | null) ?? -Infinity)) * multiplier
  }

  if (typeof leftValue === 'boolean' || typeof rightValue === 'boolean') {
    return (Number(leftValue ?? false) - Number(rightValue ?? false)) * multiplier
  }

  return String(leftValue ?? '').localeCompare(String(rightValue ?? ''), 'th', { numeric: true }) * multiplier
}

type ProductSubmitPayload = {
  imageAction: 'keep' | 'remove' | 'replace'
  imageFile: File | null
  values: ProductFormValues
}

export function ProductsPageClient() {
  const [activeFilter, setActiveFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [pendingToggleIds, setPendingToggleIds] = useState<Set<string>>(new Set())
  const [productTypeFilter, setProductTypeFilter] = useState('')
  const [productTypes, setProductTypes] = useState<MasterDataRecord[]>([])
  const [productUnits, setProductUnits] = useState<MasterDataRecord[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [sortKey, setSortKey] = useState<SortKey>('code')

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      const [result, typeRows, unitRows] = await Promise.all([
        listProducts({ all: true }),
        listMasterDataRecords('/api/master-data/product-types'),
        listMasterDataRecords('/api/master-data/product-units'),
      ])
      setProducts(result.rows)
      setProductTypes(typeRows.filter((type) => type.active))
      setProductUnits(unitRows.filter((unit) => unit.active))
    } catch (caught) {
      setError(getErrorMessage(caught, 'โหลดข้อมูลสินค้าไม่ได้'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const productTypeOptions = useMemo(() => {
    const activeTypeNames = productTypes.map((type) => type.name)
    const existingTypeNames = uniqueText(products.map((product) => product.type))
    return Array.from(new Set([...activeTypeNames, ...existingTypeNames])).sort((a, b) => a.localeCompare(b, 'th', { numeric: true }))
  }, [productTypes, products])

  const filteredSortedProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    const rows = products.filter((product) => {
      if (activeFilter === 'active' && !product.active) return false
      if (activeFilter === 'inactive' && product.active) return false
      if (productTypeFilter && product.type !== productTypeFilter) return false
      if (!query) return true

      return Object.values(product).some((value) => String(value ?? '').toLowerCase().includes(query))
    })

    return [...rows].sort((left, right) => compareProducts(left, right, sortKey, sortDirection))
  }, [activeFilter, productTypeFilter, products, search, sortDirection, sortKey])

  const total = filteredSortedProducts.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedProducts = filteredSortedProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  function openCreateForm() {
    setSelectedProduct(null)
    setFormOpen(true)
  }

  function openEditForm(product: Product) {
    setSelectedProduct(product)
    setFormOpen(true)
  }

  async function handleSubmit({ imageAction, imageFile, values }: ProductSubmitPayload) {
    setIsSaving(true)
    setError(null)
    try {
      const previousImageKey = selectedProduct?.imageStorageKey ?? null
      const previousThumbKey = selectedProduct?.imageThumbnailStorageKey ?? null
      const initialImageKey = imageAction === 'remove' ? null : previousImageKey
      const initialThumbKey = imageAction === 'remove' ? null : previousThumbKey
      let savedProduct = await saveProduct({
        ...values,
        imageStorageKey: initialImageKey,
        imageThumbnailStorageKey: initialThumbKey,
      })

      if (imageAction === 'replace' && imageFile) {
        const supabase = getSupabaseClient()
        if (!supabase) {
          throw new Error('ไม่พบการเชื่อมต่อ Supabase สำหรับอัปโหลดรูปสินค้า')
        }

        const assets = await prepareProductImageUploadAssets(imageFile)
        const nextImageKey = buildProductOriginalImageStorageKey(savedProduct.code, imageFile.name)
        const nextThumbKey = buildProductThumbnailStorageKey(savedProduct.code, imageFile.name)
        const uploadedKeys: string[] = []
        const storage = supabase.storage.from(PRODUCT_IMAGE_BUCKET)

        try {
          const { error: originalUploadError } = await storage.upload(nextImageKey, assets.original, {
            cacheControl: '3600',
            contentType: assets.original.type || undefined,
            upsert: true,
          })

          if (originalUploadError) {
            throw new Error(`อัปโหลดรูปสินค้าหลักไม่สำเร็จ: ${originalUploadError.message}`)
          }
          uploadedKeys.push(nextImageKey)

          const { error: thumbUploadError } = await storage.upload(nextThumbKey, assets.thumbnail, {
            cacheControl: '3600',
            contentType: assets.thumbnail.type || undefined,
            upsert: true,
          })

          if (thumbUploadError) {
            throw new Error(`อัปโหลดรูปสินค้าย่อไม่สำเร็จ: ${thumbUploadError.message}`)
          }
          uploadedKeys.push(nextThumbKey)

          savedProduct = await saveProduct({
            ...values,
            id: savedProduct.id,
            code: savedProduct.code,
            imageStorageKey: nextImageKey,
            imageThumbnailStorageKey: nextThumbKey,
          })
        } catch (uploadOrSaveError) {
          if (uploadedKeys.length > 0) {
            void storage.remove(uploadedKeys).catch(() => undefined)
          }
          throw uploadOrSaveError
        }

        const oldKeys = [previousImageKey, previousThumbKey]
          .filter((value): value is string => Boolean(value))
          .filter((value) => value !== nextImageKey && value !== nextThumbKey)

        if (oldKeys.length > 0) {
          void storage.remove(oldKeys).catch(() => undefined)
        }
      } else if (imageAction === 'remove' && (previousImageKey || previousThumbKey)) {
        const supabase = getSupabaseClient()
        if (supabase) {
          const oldKeys = [previousImageKey, previousThumbKey].filter((value): value is string => Boolean(value))
          if (oldKeys.length > 0) {
            void supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove(oldKeys).catch(() => undefined)
          }
        }
      }

      setFormOpen(false)
      setSelectedProduct(null)
      await loadData()
    } catch (caught) {
      setError(getErrorMessage(caught, 'บันทึกข้อมูลสินค้าไม่ได้'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleActive(product: Product, active: boolean) {
    setError(null)
    setPendingToggleIds((current) => new Set(current).add(product.id))
    setProducts((current) => current.map((row) => row.id === product.id ? { ...row, active } : row))
    setSelectedProduct((current) => current?.id === product.id ? { ...current, active } : current)

    try {
      const updatedProduct = await setProductActive(product.id, active)
      setProducts((current) => current.map((row) => row.id === updatedProduct.id ? updatedProduct : row))
      setSelectedProduct((current) => current?.id === updatedProduct.id ? updatedProduct : current)
    } catch (caught) {
      setProducts((current) => current.map((row) => row.id === product.id ? { ...row, active: product.active } : row))
      setSelectedProduct((current) => current?.id === product.id ? { ...current, active: product.active } : current)
      setError(getErrorMessage(caught, 'อัปเดตสถานะสินค้าไม่ได้'))
    } finally {
      setPendingToggleIds((current) => {
        const next = new Set(current)
        next.delete(product.id)
        return next
      })
    }
  }

  async function handleExport() {
    setError(null)
    setIsExporting(true)
    try {
      const { blob, filename } = await exportProducts({
        active: activeFilter,
        direction: sortDirection,
        productType: productTypeFilter,
        q: search,
        sort: sortKey,
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (caught) {
      setError(getErrorMessage(caught, 'Export Excel ไม่สำเร็จ'))
    } finally {
      setIsExporting(false)
    }
  }

  async function handleImport(file: File | null) {
    if (!file) return
    setError(null)
    setIsImporting(true)
    try {
      const result = await importProducts(file)
      await loadData()
      window.alert(`Import สำเร็จ ${result.totalRows.toLocaleString('th-TH')} รายการ: เพิ่มใหม่ ${result.inserted.toLocaleString('th-TH')} / อัปเดต ${result.updated.toLocaleString('th-TH')}`)
    } catch (caught) {
      setError(getErrorMessage(caught, 'Import Excel ไม่สำเร็จ'))
    } finally {
      setIsImporting(false)
    }
  }

  function setSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
      setPage(1)
      return
    }

    setSortKey(key)
    setSortDirection('asc')
    setPage(1)
  }

  function sortLabel(key: SortKey) {
    if (sortKey !== key) return ''
    return sortDirection === 'asc' ? ' ↑' : ' ↓'
  }

  function resetFilters() {
    setActiveFilter('')
    setProductTypeFilter('')
    setSearch('')
    setPage(1)
  }

  return (
    <section className="space-y-4">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-bold">โหลดหรือบันทึกข้อมูลสินค้าไม่ได้</div>
          <div className="mt-1">{error}</div>
        </div>
      ) : null}

      <div className="rounded-md bg-white p-3 shadow">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid w-full gap-2 md:grid-cols-2 xl:max-w-3xl xl:grid-cols-[minmax(0,1fr)_190px_130px]">
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              onChange={(event) => {
                setPage(1)
                setSearch(event.target.value)
              }}
              placeholder="ค้นหา..."
              type="search"
              value={search}
            />
            <select
              aria-label="กรองประเภทสินค้า"
              className="rounded-md border px-3 py-2 text-sm"
              value={productTypeFilter}
              onChange={(event) => {
                setPage(1)
                setProductTypeFilter(event.target.value)
              }}
            >
              <option value="">ทุกประเภท</option>
              {productTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <select
              aria-label="กรองสถานะใช้งาน"
              className="rounded-md border px-3 py-2 text-sm"
              value={activeFilter}
              onChange={(event) => {
                setPage(1)
                setActiveFilter(event.target.value)
              }}
            >
              <option value="">ทั้งหมด</option>
              <option value="active">ใช้งาน</option>
              <option value="inactive">ปิด</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" type="button" onClick={resetFilters}>
              ล้างตัวกรอง
            </button>
            <button className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60" disabled={isExporting || isLoading} type="button" onClick={() => void handleExport()}>
              {isExporting ? 'กำลัง Export...' : '📊 Export Excel'}
            </button>
            <label className={`cursor-pointer rounded-md bg-blue-600 px-3 py-2 text-sm font-bold text-white ${isImporting || isLoading ? 'pointer-events-none opacity-60' : ''}`}>
              {isImporting ? 'กำลัง Import...' : 'Import Excel'}
              <input
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                disabled={isImporting || isLoading}
                type="file"
                onChange={(event) => {
                  void handleImport(event.target.files?.[0] ?? null)
                  event.currentTarget.value = ''
                }}
              />
            </label>
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white" type="button" onClick={openCreateForm}>
              + เพิ่มสินค้า
            </button>
          </div>
        </div>
      </div>

      {!isLoading ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-slate-600">
          <div>
            พบทั้งหมด <span className="font-semibold text-slate-900">{total.toLocaleString('th-TH')}</span> รายการ
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="จำนวนรายการต่อหน้า"
              className="rounded-md border border-slate-300 px-2 py-1"
              value={pageSize}
              onChange={(event) => {
                setPage(1)
                setPageSize(Number(event.target.value))
              }}
            >
              <option value={10}>10 / หน้า</option>
              <option value={25}>25 / หน้า</option>
              <option value={50}>50 / หน้า</option>
              <option value={100}>100 / หน้า</option>
            </select>
            <button className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-50" disabled={page <= 1 || isLoading} type="button" onClick={() => setPage(Math.max(1, page - 1))}>
              ก่อนหน้า
            </button>
            <span className="px-1">
              หน้า {currentPage.toLocaleString('th-TH')} / {totalPages.toLocaleString('th-TH')}
            </span>
            <button className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-50" disabled={page >= totalPages || isLoading} type="button" onClick={() => setPage(Math.min(totalPages, currentPage + 1))}>
              ถัดไป
            </button>
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 pt-8">
          <div className="w-full max-w-4xl">
            <ProductForm
              isSaving={isSaving}
              product={selectedProduct}
              productTypes={productTypeOptions}
              productUnits={productUnits}
              onCancel={() => {
                setFormOpen(false)
                setSelectedProduct(null)
              }}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      ) : null}

      {isLoading ? <div className="rounded-md bg-white p-6 text-center text-sm text-slate-500 shadow">กำลังโหลดข้อมูลสินค้า</div> : null}

      {!isLoading ? (
        <div className="overflow-x-auto rounded-md bg-white shadow">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left"><button className="font-semibold" type="button" onClick={() => setSort('code')}>รหัส{sortLabel('code')}</button></th>
                <th className="min-w-[220px] p-2 text-left"><button className="font-semibold" type="button" onClick={() => setSort('name')}>ชื่อสินค้า{sortLabel('name')}</button></th>
                <th className="p-2 text-left"><button className="font-semibold" type="button" onClick={() => setSort('type')}>ประเภท{sortLabel('type')}</button></th>
                <th className="p-2 text-center"><button className="font-semibold" type="button" onClick={() => setSort('unit')}>หน่วย{sortLabel('unit')}</button></th>
                <th className="p-2 text-center"><button className="font-semibold" type="button" onClick={() => setSort('active')}>สถานะ{sortLabel('active')}</button></th>
                <th className="p-2 text-center">แก้ไข</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map((product) => (
                <tr
                  key={product.id}
                  className="cursor-pointer border-t hover:bg-slate-50"
                  role="button"
                  tabIndex={0}
                  onClick={() => openEditForm(product)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openEditForm(product)
                    }
                  }}
                >
                  <td className="p-2 font-mono text-xs">{product.code}</td>
                  <td className="p-2 font-medium">{product.name}</td>
                  <td className="p-2">{displayValue(product.type)}</td>
                  <td className="p-2 text-center">{displayValue(product.unit)}</td>
                  <td className="p-2 text-center">
                    <ActiveToggle
                      checked={product.active}
                      disabled={pendingToggleIds.has(product.id)}
                      label={product.active ? 'ใช้งาน' : 'ปิด'}
                      onChange={(active) => void handleToggleActive(product, active)}
                    />
                  </td>
                  <td className="p-2 text-center">
                    <button
                      className="text-blue-600"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        openEditForm(product)
                      }}
                    >
                      แก้ไข
                    </button>
                  </td>
                </tr>
              ))}
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td className="p-4 text-center text-sm text-slate-500" colSpan={6}>ไม่พบข้อมูลที่ค้นหา</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

type ProductFormProps = {
  isSaving: boolean
  product: Product | null
  productTypes: string[]
  productUnits: MasterDataRecord[]
  onCancel: () => void
  onSubmit: (payload: ProductSubmitPayload) => Promise<void>
}

function ProductForm({ isSaving, product, productTypes, productUnits, onCancel, onSubmit }: ProductFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState<ProductFormValues>(() => (product ? productToForm(product) : emptyProductForm))
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null)
  const [previewImageName, setPreviewImageName] = useState('')
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(product?.thumbnailUrl ?? null)

  useEffect(() => {
    setForm(product ? productToForm(product) : emptyProductForm)
    setPendingImageFile(null)
    setPreviewImageName(product?.imageNames[0] ?? '')
    setPreviewImageUrl(product?.thumbnailUrl ?? null)
    setErrors({})
  }, [product])

  function update<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function replacePrimaryImage(fileList: FileList | null) {
    const selectedFile = Array.from(fileList ?? [])[0]
    if (!selectedFile) return
    if (!selectedFile.type.startsWith('image/')) {
      setErrors((current) => ({ ...current, imageStorageKey: 'อัปโหลดได้เฉพาะไฟล์รูปภาพ' }))
      return
    }

    const nextPreviewUrl = await fileToDataUrl(selectedFile)
    setErrors((current) => {
      const nextErrors = { ...current }
      delete nextErrors.imageStorageKey
      return nextErrors
    })
    setPendingImageFile(selectedFile)
    setPreviewImageName(selectedFile.name)
    setPreviewImageUrl(nextPreviewUrl)
  }

  function removeProductImage() {
    setPendingImageFile(null)
    setPreviewImageName('')
    setPreviewImageUrl(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = productFormSchema.safeParse(form)
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])))
      return
    }

    setErrors({})
    await onSubmit({
      imageAction: pendingImageFile ? 'replace' : (previewImageUrl ? 'keep' : 'remove'),
      imageFile: pendingImageFile,
      values: parsed.data,
    })
  }

  return (
    <form className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-bold text-slate-900">{form.id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</h3>
        <ActiveToggle checked={form.active} onChange={(checked) => update('active', checked)} />
      </div>

      <div className="max-h-[76vh] space-y-5 overflow-y-auto px-5 py-5">
        <section>
          <h4 className="mb-3 text-sm font-bold text-slate-700">ข้อมูลสินค้า</h4>
          <div className="grid gap-3 md:grid-cols-4">
            {form.id ? <TextField error={errors.code} label="รหัสสินค้า" readOnly value={form.code ?? ''} onChange={(value) => update('code', value)} /> : null}
            <TextField error={errors.name} label="ชื่อสินค้า *" value={form.name} onChange={(value) => update('name', value)} />
            <SelectField error={errors.type} label="ประเภทสินค้า" value={form.type ?? ''} onChange={(value) => update('type', value || null)}>
              <option value="">เลือกประเภทสินค้า</option>
              {productTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </SelectField>
            <SelectField error={errors.unit} label="หน่วย" value={form.unit ?? ''} onChange={(value) => update('unit', value || null)}>
              <option value="">เลือกหน่วย</option>
              {productUnits.map((unit) => {
                const value = unit.symbol || unit.name
                const label = unit.symbol && unit.symbol !== unit.name ? `${unit.name} (${unit.symbol})` : unit.name
                return <option key={unit.id} value={value}>{label}</option>
              })}
            </SelectField>
            <div className="md:col-span-4">
              <div className="block text-xs font-medium text-slate-600">
                รูปสินค้า
                <div className={`mt-1 rounded-md border bg-slate-50 p-3 ${errors.imageStorageKey ? 'border-red-300' : 'border-slate-200'}`}>
                  <div className="flex flex-col gap-2">
                    <div>
                      <label className="group relative block h-36 w-36 cursor-pointer overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100 hover:border-slate-400">
                        {previewImageUrl ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img alt={previewImageName || 'รูปสินค้า'} className="h-full w-full object-cover" src={previewImageUrl} />
                            <span className="absolute inset-x-0 bottom-0 bg-slate-950/70 px-2 py-1.5 text-center text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                              คลิกเพื่อเปลี่ยนรูป
                            </span>
                          </>
                        ) : (
                          <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                              <ImagePlus className="h-6 w-6" />
                            </span>
                            <span className="px-3 text-center text-xs font-medium text-slate-500">เพิ่มรูปสินค้า</span>
                          </span>
                        )}
                        <input
                          accept="image/*"
                          className="hidden"
                          type="file"
                          onChange={(event) => {
                            void replacePrimaryImage(event.target.files)
                            event.target.value = ''
                          }}
                        />
                      </label>
                      {previewImageUrl ? (
                        <button className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline" type="button" onClick={removeProductImage}>
                          <Trash2 className="h-3.5 w-3.5" />
                          ลบรูปหลัก
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {errors.imageStorageKey ? <div className="mt-2 text-xs text-red-700">{errors.imageStorageKey}</div> : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
        <button className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100" type="button" onClick={onCancel}>
          ยกเลิก
        </button>
        <button className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60" disabled={isSaving} type="submit">
          {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </form>
  )
}

type SelectFieldProps = {
  children: React.ReactNode
  error?: string
  label: string
  value: string
  onChange: (value: string) => void
}

function SelectField({ children, error, label, value, onChange }: SelectFieldProps) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <select
        className={`mt-1 h-9 w-full rounded-md border px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-700 ${error ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white'}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  )
}

type TextFieldProps = {
  className?: string
  error?: string
  label: string
  list?: string
  readOnly?: boolean
  type?: string
  value: string | number
  onChange: (value: string) => void
}

function TextField({ className = '', error, label, list, readOnly = false, type = 'text', value, onChange }: TextFieldProps) {
  return (
    <label className={`block text-xs font-medium text-slate-600 ${className}`}>
      {label}
      <input
        className={`mt-1 h-9 w-full rounded-md border px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-700 ${error ? 'border-red-300 bg-red-50' : readOnly ? 'border-slate-300 bg-slate-50' : 'border-slate-300 bg-white'}`}
        list={list}
        min={type === 'number' ? 0 : undefined}
        readOnly={readOnly}
        step={type === 'number' ? '0.01' : undefined}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  )
}
