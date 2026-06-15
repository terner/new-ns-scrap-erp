'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type AssetRegisterRow = {
  acquisitionType: string
  accumDep: number
  assetStatus: string
  branchId: string
  branchName: string
  category: string
  chassisNo: string
  code: string
  department: string
  depreciationMethod: string
  engineNo: string
  id: string
  insurancePolicyNo: string
  licensePlate: string
  location: string
  monthlyDep: number
  name: string
  nbv: number
  netAssetCost: number
  notes: string
  originalCost: number
  purchaseDate: string
  responsiblePerson: string
  salvageValue: number
  serialNo: string
  supplierId: string
  supplierName: string
  usefulLifeMonths: number
  vatAmount: number
  warrantyExpireDate: string
}

type AssetRegisterPayload = {
  byCategory: { category: string; count: number; cost: number; monthlyDep: number; nbv: number }[]
  filters: { categories: string[]; statuses: string[] }
  options: {
    acquisitionTypes: string[]
    assetStatuses: string[]
    branches: { code: string; id: string; name: string }[]
    categories: string[]
    depreciationMethods: string[]
    suppliers: { code: string; id: string; name: string }[]
  }
  rows: AssetRegisterRow[]
  summary: { accumDep: number; count: number; monthlyDep: number; nbv: number; netAssetCost: number }
}

type AssetFormState = {
  acquisitionType: string
  assetStatus: string
  branchId: string
  category: string
  chassisNo: string
  code: string
  department: string
  depreciationMethod: string
  engineNo: string
  id: string
  insurancePolicyNo: string
  licensePlate: string
  location: string
  name: string
  netAssetCost: string
  notes: string
  originalCost: string
  purchaseDate: string
  responsiblePerson: string
  salvageValue: string
  serialNo: string
  supplierId: string
  usefulLifeMonths: string
  vatAmount: string
  warrantyExpireDate: string
}

type ImportPreviewRow = { code: string; errors: string[]; index: number; mode: string; name: string }

const blankAssetForm: AssetFormState = {
  acquisitionType: 'Purchased',
  assetStatus: 'Active',
  branchId: '',
  category: 'Other',
  chassisNo: '',
  code: '',
  department: '',
  depreciationMethod: 'Straight Line',
  engineNo: '',
  id: '',
  insurancePolicyNo: '',
  licensePlate: '',
  location: '',
  name: '',
  netAssetCost: '',
  notes: '',
  originalCost: '',
  purchaseDate: '',
  responsiblePerson: '',
  salvageValue: '0',
  serialNo: '',
  supplierId: '',
  usefulLifeMonths: '60',
  vatAmount: '0',
  warrantyExpireDate: '',
}

const fieldClass = 'w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100'

type DepreciationPayload = {
  designState: { glPosting: string; reverseWrite: string; runWrite: string }
  pendingAssets: { accumDep: number; assetStatus: string; code: string; id: string; monthlyDep: number; name: string; nbv: number; netAssetCost: number }[]
  period: { date: string; key: string; month: number; postedRuns: number; pendingAssets: number; year: number }
  rows: { accumAfter: number; accumBefore: number; assetCode: string; assetName: string; date: string; depreciationAmount: number; id: string; nbvAfter: number; nbvBefore: number; period: string; refNo: string; reversalReason: string; reversedAt: string; status: string }[]
  summary: { pendingAssets: number; postedRuns: number; reversedRuns: number; totalDepreciation: number }
}

type DepreciationPreview = {
  periodDate: string
  periodKey: string
  rows: { accumAfter: number; accumBefore: number; assetCode: string; assetId: string; assetName: string; depreciationAmount: number; monthlyDep: number; nbvAfter: number; nbvBefore: number; netAssetCost: number; salvageValue: number; willFullyDepreciate: boolean }[]
  summary: { count: number; totalDepreciation: number; willFullyDepreciate: number }
}

type DisposalPayload = {
  assetOptions: { assetStatus: string; code: string; id: string; label: string; name: string; nbv: number; purchaseDate: string }[]
  customerOptions: { code: string; id: string; name: string }[]
  designState: { glPosting: string; reversal: string; writeBehavior: string }
  disposalTypes: string[]
  rows: { assetCode: string; assetName: string; customerCode: string; customerName: string; date: string; disposalNo: string; disposalType: string; gainLoss: number; id: string; nbv: number; notes: string; reason: string; receiptRefNo: string; reversalReason: string; reversedAt: string; sellingPrice: number; status: string }[]
  summary: { activeAssets: number; disposedRows: number; gainLoss: number; proceeds: number; reversedRows: number }
}

type DisposalFormState = {
  assetId: string
  customerId: string
  disposalDate: string
  disposalType: string
  notes: string
  reason: string
  receiptRefNo: string
  sellingPrice: string
}

const blankDisposalForm = (): DisposalFormState => ({
  assetId: '',
  customerId: '',
  disposalDate: new Date().toISOString().slice(0, 10),
  disposalType: 'Sale',
  notes: '',
  reason: '',
  receiptRefNo: '',
  sellingPrice: '0',
})

export function AssetRegisterPageClient() {
  const [category, setCategory] = useState('all')
  const [data, setData] = useState<AssetRegisterPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<AssetFormState>(blankAssetForm)
  const [importRows, setImportRows] = useState<Omit<AssetFormState, 'id'>[]>([])
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [modal, setModal] = useState<'asset' | 'import' | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    if (category !== 'all') params.set('category', category)
    if (status !== 'all') params.set('status', status)
    return params.toString()
  }, [category, search, status])
  const apiHref = `/api/finance-accounting/asset-register${queryString ? `?${queryString}` : ''}`
  const exportHref = `/api/finance-accounting/asset-register?${new URLSearchParams({ ...(queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {}), format: 'csv' }).toString()}`

  const loadData = useCallback(() => {
    setIsLoading(true)
    dailyFetchJson<AssetRegisterPayload>(apiHref)
      .then(setData)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลดทะเบียนทรัพย์สินไม่ได้'))
      .finally(() => setIsLoading(false))
  }, [apiHref])

  useEffect(() => loadData(), [loadData])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (data?.rows ?? []).filter((row) => {
      const matchesSearch = !needle || [row.code, row.name, row.location, row.branchName].join(' ').toLowerCase().includes(needle)
      const matchesCategory = category === 'all' || row.category === category
      const matchesStatus = status === 'all' || row.assetStatus === status
      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [category, data?.rows, search, status])

  const openCreate = () => {
    setError(null)
    setForm(blankAssetForm)
    setModal('asset')
  }

  const openEdit = (row: AssetRegisterRow) => {
    setError(null)
    setForm(assetRowToForm(row))
    setModal('asset')
  }

  const updateForm = (field: keyof AssetFormState, value: string) => {
    setForm((current) => {
      const next = { ...current, [field]: value }
      if (field === 'originalCost' || field === 'vatAmount') {
        const originalCost = decimalValue(field === 'originalCost' ? value : next.originalCost)
        const vatAmount = decimalValue(field === 'vatAmount' ? value : next.vatAmount)
        if (originalCost > 0) next.netAssetCost = formatInputNumber(Math.max(0, originalCost - vatAmount))
      }
      return next
    })
  }

  const saveAsset = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const result = await dailyFetchJson<{ payload: AssetRegisterPayload }>('/api/finance-accounting/asset-register', {
        body: JSON.stringify(formToPayload(form)),
        method: 'POST',
      })
      setData(result.payload)
      setModal(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกทะเบียนทรัพย์สินไม่ได้')
    } finally {
      setIsSaving(false)
    }
  }

  const deactivateAsset = async (row: AssetRegisterRow) => {
    if (!window.confirm(`ปิดใช้งานทรัพย์สิน ${row.code} ?`)) return
    setIsSaving(true)
    setError(null)
    try {
      const result = await dailyFetchJson<{ payload: AssetRegisterPayload }>('/api/finance-accounting/asset-register', {
        body: JSON.stringify({ action: 'deactivate', id: row.id, reason: 'deactivated from asset register page' }),
        method: 'PATCH',
      })
      setData(result.payload)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ปิดใช้งานทรัพย์สินไม่ได้')
    } finally {
      setIsSaving(false)
    }
  }

  const previewImport = async (rowsToPreview = importRows) => {
    if (!rowsToPreview.length) {
      setError('เลือกไฟล์ CSV/TSV ก่อนนำเข้า')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const result = await dailyFetchJson<{ rows: ImportPreviewRow[] }>('/api/finance-accounting/asset-register', {
        body: JSON.stringify({ action: 'previewImport', rows: rowsToPreview.map(formToPayload) }),
        method: 'POST',
      })
      setImportPreview(result.rows)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ตรวจไฟล์นำเข้าไม่ได้')
    } finally {
      setIsSaving(false)
    }
  }

  const commitImport = async () => {
    if (!importRows.length || importPreview?.some((row) => row.errors.length)) return
    setIsSaving(true)
    setError(null)
    try {
      const result = await dailyFetchJson<{ payload: AssetRegisterPayload }>('/api/finance-accounting/asset-register', {
        body: JSON.stringify({ action: 'commitImport', rows: importRows.map(formToPayload) }),
        method: 'POST',
      })
      setData(result.payload)
      setImportRows([])
      setImportPreview(null)
      setModal(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'นำเข้าทะเบียนทรัพย์สินไม่ได้')
    } finally {
      setIsSaving(false)
    }
  }

  const importBlocked = importPreview?.some((row) => row.errors.length) ?? true

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-md bg-white p-3 shadow">
        <LinkButton href="/api/finance-accounting/asset-register?template=csv">📄 Template</LinkButton>
        <ActionButton onClick={() => { setError(null); setImportRows([]); setImportPreview(null); setModal('import') }}>📥 Import</ActionButton>
        <LinkButton href={exportHref}>📤 Export CSV</LinkButton>
        <ActionButton strong onClick={openCreate}>+ เพิ่มทรัพย์สิน</ActionButton>
      </div>

      {error ? <ErrorBox message={error} /> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-md bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-5 text-white shadow">
          <div className="text-sm opacity-90">Net Book Value</div>
          <div className="mt-2 text-3xl font-bold">{formatMoney(data?.summary.nbv)} ฿</div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><div className="opacity-80">ต้นทุนสุทธิ</div><div className="font-semibold">{formatMoney(data?.summary.netAssetCost)}</div></div>
            <div><div className="opacity-80">ค่าเสื่อมสะสม</div><div className="font-semibold">{formatMoney(data?.summary.accumDep)}</div></div>
          </div>
        </div>
        <Panel title="NBV ตามหมวด">
          <div className="space-y-2">
            {(data?.byCategory ?? []).slice(0, 6).map((item) => <Bar key={item.category} label={`${item.category} (${item.count})`} max={data?.summary.nbv ?? 0} value={item.nbv} />)}
            {!isLoading && (data?.byCategory.length ?? 0) === 0 ? <EmptyText>ยังไม่มีทรัพย์สิน</EmptyText> : null}
          </div>
        </Panel>
        <Panel title="ค่าเสื่อม/เดือน">
          <div className="text-2xl font-bold text-amber-700">{formatMoney(data?.summary.monthlyDep)} ฿</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <MiniStat label="รายการ" value={data?.summary.count ?? 0} />
            <MiniStat label="แสดงผล" value={rows.length} />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="จำนวนทรัพย์สิน" value={data?.summary.count ?? 0} />
        <StatCard label="ต้นทุนสุทธิ" value={formatMoney(data?.summary.netAssetCost)} />
        <StatCard label="ค่าเสื่อมสะสม" value={formatMoney(data?.summary.accumDep)} tone="amber" />
        <StatCard label="NBV" value={formatMoney(data?.summary.nbv)} tone="emerald" />
      </div>

      <FilterPanel>
        <input className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="ค้นหา รหัส / ชื่อ / สถานที่ / สาขา" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">ทุกหมวด</option>
          {(data?.filters.categories ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">ทุกสถานะ</option>
          {(data?.filters.statuses ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <LinkButton href={exportHref}>CSV</LinkButton>
      </FilterPanel>

      <TableShell>
        <table className="w-full text-xs">
          <thead className="bg-slate-100 text-slate-600">
            <tr><Th>รหัส</Th><Th>ชื่อ + location</Th><Th>หมวด</Th><Th>สาขา</Th><Th>วันที่ซื้อ</Th><Th align="right">ต้นทุน/Net Cost</Th><Th align="right">ค่าเสื่อมสะสม</Th><Th align="right">NBV</Th><Th align="right">ค่าเสื่อม/เดือน</Th><Th align="center">สถานะ</Th><Th align="center">actions</Th></tr>
          </thead>
          <tbody>
            <LoadingOrEmpty colSpan={11} isLoading={isLoading} rows={rows.length} />
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                <Td><span className="font-mono font-semibold text-amber-700">{row.code}</span></Td>
                <Td><div className="font-medium text-slate-900">{row.name}</div><div className="text-slate-400">{row.location || '-'}</div></Td>
                <Td>{row.category}</Td><Td>{row.branchName}</Td><Td>{row.purchaseDate || '-'}</Td>
                <Td align="right">{formatMoney(row.netAssetCost)}</Td><Td align="right">{formatMoney(row.accumDep)}</Td><Td align="right" strong>{formatMoney(row.nbv)}</Td><Td align="right">{formatMoney(row.monthlyDep)}</Td>
                <Td align="center"><StatusPill status={row.assetStatus} /></Td>
                <Td align="center">
                  <div className="flex justify-center gap-1">
                    <button className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50" disabled={isSaving} onClick={() => openEdit(row)} type="button">แก้ไข</button>
                    {!['Inactive', 'Sold', 'Disposed', 'Lost'].includes(row.assetStatus) ? (
                      <button className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50" disabled={isSaving} onClick={() => deactivateAsset(row)} type="button">ปิดใช้งาน</button>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      {modal === 'asset' ? (
        <Modal title={form.id ? `แก้ไขทรัพย์สิน ${form.code}` : 'เพิ่มทรัพย์สิน'}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="รหัสทรัพย์สิน"><input className={fieldClass} value={form.code} onChange={(event) => updateForm('code', event.target.value.toUpperCase())} /></Field>
            <Field label="ชื่อทรัพย์สิน"><input className={fieldClass} value={form.name} onChange={(event) => updateForm('name', event.target.value)} /></Field>
            <Field label="หมวด"><SelectControl options={data?.options.categories ?? []} value={form.category} onChange={(value) => updateForm('category', value)} /></Field>
            <Field label="สาขา"><OptionSelect blankLabel="ไม่ระบุสาขา" options={data?.options.branches ?? []} value={form.branchId} onChange={(value) => updateForm('branchId', value)} /></Field>
            <Field label="แผนก"><input className={fieldClass} value={form.department} onChange={(event) => updateForm('department', event.target.value)} /></Field>
            <Field label="สถานที่"><input className={fieldClass} value={form.location} onChange={(event) => updateForm('location', event.target.value)} /></Field>
            <Field label="วันที่ซื้อ"><input className={fieldClass} type="date" value={form.purchaseDate} onChange={(event) => updateForm('purchaseDate', event.target.value)} /></Field>
            <Field label="ประเภทการได้มา"><SelectControl options={data?.options.acquisitionTypes ?? []} value={form.acquisitionType} onChange={(value) => updateForm('acquisitionType', value)} /></Field>
            <Field label="ผู้ขาย"><OptionSelect blankLabel="ไม่ระบุผู้ขาย" options={data?.options.suppliers ?? []} value={form.supplierId} onChange={(value) => updateForm('supplierId', value)} /></Field>
            <MoneyField label="ราคาทุน" value={form.originalCost} onChange={(value) => updateForm('originalCost', value)} />
            <MoneyField label="VAT" value={form.vatAmount} onChange={(value) => updateForm('vatAmount', value)} />
            <MoneyField label="Net Asset Cost" value={form.netAssetCost} onChange={(value) => updateForm('netAssetCost', value)} />
            <MoneyField label="มูลค่าซาก" value={form.salvageValue} onChange={(value) => updateForm('salvageValue', value)} />
            <Field label="อายุใช้งาน (เดือน)"><input className={fieldClass} inputMode="numeric" value={form.usefulLifeMonths} onChange={(event) => updateForm('usefulLifeMonths', event.target.value)} /></Field>
            <Field label="วิธีคิดค่าเสื่อม"><SelectControl options={data?.options.depreciationMethods ?? []} value={form.depreciationMethod} onChange={(value) => updateForm('depreciationMethod', value)} /></Field>
            <Field label="สถานะ"><SelectControl options={data?.options.assetStatuses ?? []} value={form.assetStatus} onChange={(value) => updateForm('assetStatus', value)} /></Field>
            <Field label="Serial No."><input className={fieldClass} value={form.serialNo} onChange={(event) => updateForm('serialNo', event.target.value)} /></Field>
            <Field label="ทะเบียนรถ"><input className={fieldClass} value={form.licensePlate} onChange={(event) => updateForm('licensePlate', event.target.value)} /></Field>
            <Field label="เลขตัวถัง"><input className={fieldClass} value={form.chassisNo} onChange={(event) => updateForm('chassisNo', event.target.value)} /></Field>
            <Field label="เลขเครื่อง"><input className={fieldClass} value={form.engineNo} onChange={(event) => updateForm('engineNo', event.target.value)} /></Field>
            <Field label="กรมธรรม์"><input className={fieldClass} value={form.insurancePolicyNo} onChange={(event) => updateForm('insurancePolicyNo', event.target.value)} /></Field>
            <Field label="หมดประกัน"><input className={fieldClass} type="date" value={form.warrantyExpireDate} onChange={(event) => updateForm('warrantyExpireDate', event.target.value)} /></Field>
            <Field label="ผู้รับผิดชอบ"><input className={fieldClass} value={form.responsiblePerson} onChange={(event) => updateForm('responsiblePerson', event.target.value)} /></Field>
            <div className="md:col-span-3"><Field label="หมายเหตุ"><textarea className={`${fieldClass} min-h-20`} value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} /></Field></div>
          </div>
          <ModalActions>
            <ActionButton onClick={() => setModal(null)}>ยกเลิก</ActionButton>
            <ActionButton strong disabled={isSaving} onClick={saveAsset}>{isSaving ? 'กำลังบันทึก' : 'บันทึก'}</ActionButton>
          </ModalActions>
        </Modal>
      ) : null}

      {modal === 'import' ? (
        <Modal title="Import Asset Register">
          <div className="space-y-3">
            <input
              accept=".csv,.tsv,.txt"
              className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                file.text().then((content) => {
                  const parsedRows = parseAssetImportText(content)
                  setImportRows(parsedRows)
                  setImportPreview(null)
                  void previewImport(parsedRows)
                }).catch(() => setError('อ่านไฟล์นำเข้าไม่ได้'))
              }}
            />
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">รองรับ CSV/TSV ตามหัวคอลัมน์จาก template ก่อน commit ระบบจะ preview และ block แถวที่ซ้ำหรือ reference ไม่ถูกต้อง</div>
            {importPreview ? (
              <TableShell>
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-600"><tr><Th>#</Th><Th>รหัส</Th><Th>ชื่อ</Th><Th>ผลตรวจ</Th></tr></thead>
                  <tbody>
                    {importPreview.slice(0, 100).map((row) => (
                      <tr key={`${row.index}-${row.code}`} className="border-t border-slate-100">
                        <Td>{row.index}</Td><Td><span className="font-mono">{row.code}</span></Td><Td>{row.name}</Td><Td>{row.errors.length ? <span className="text-red-700">{row.errors.join(', ')}</span> : <span className="text-emerald-700">พร้อมนำเข้า</span>}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
            ) : null}
          </div>
          <ModalActions>
            <ActionButton onClick={() => setModal(null)}>ยกเลิก</ActionButton>
            <ActionButton disabled={isSaving || importBlocked} strong onClick={commitImport}>{isSaving ? 'กำลังนำเข้า' : 'Commit Import'}</ActionButton>
          </ModalActions>
        </Modal>
      ) : null}
    </section>
  )
}

export function DepreciationPageClient() {
  const [data, setData] = useState<DepreciationPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const now = new Date()
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [preview, setPreview] = useState<DepreciationPreview | null>(null)
  const [reverseRow, setReverseRow] = useState<DepreciationPayload['rows'][number] | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [year, setYear] = useState(String(now.getFullYear()))

  const loadData = useCallback(() => {
    setIsLoading(true)
    const params = new URLSearchParams({ month, year })
    dailyFetchJson<DepreciationPayload>(`/api/finance-accounting/depreciation?${params.toString()}`)
      .then(setData)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลดค่าเสื่อมราคาไม่ได้'))
      .finally(() => setIsLoading(false))
  }, [month, year])

  useEffect(() => loadData(), [loadData])

  const periodDate = useMemo(() => new Date(Number(year), Number(month), 0).toISOString().slice(0, 10), [month, year])
  const runPreview = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const result = await dailyFetchJson<DepreciationPreview>('/api/finance-accounting/depreciation', {
        body: JSON.stringify({ action: 'preview', periodMonth: month, periodYear: year }),
        method: 'POST',
      })
      setPreview(result)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Preview ค่าเสื่อมไม่ได้')
    } finally {
      setIsSaving(false)
    }
  }

  const commitRun = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const result = await dailyFetchJson<{ payload: DepreciationPayload }>('/api/finance-accounting/depreciation', {
        body: JSON.stringify({ action: 'commit', periodMonth: month, periodYear: year }),
        method: 'POST',
      })
      setData(result.payload)
      setPreview(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Run ค่าเสื่อมราคาไม่ได้')
    } finally {
      setIsSaving(false)
    }
  }

  const reverseDepreciation = async () => {
    if (!reverseRow) return
    setIsSaving(true)
    setError(null)
    try {
      await dailyFetchJson('/api/finance-accounting/depreciation', {
        body: JSON.stringify({ action: 'reverse', id: reverseRow.id, periodMonth: month, periodYear: year, reason: reverseReason }),
        method: 'PATCH',
      })
      loadData()
      setReverseRow(null)
      setReverseReason('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Reverse ค่าเสื่อมราคาไม่ได้')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      {error ? <ErrorBox message={error} /> : null}
      <FilterPanel>
        <select aria-label="Depreciation month" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" value={month} onChange={(event) => setMonth(event.target.value)}>
          {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((item) => <option key={item} value={item}>เดือน {item}</option>)}
        </select>
        <input aria-label="Depreciation year" className="w-28 rounded-md border border-slate-200 px-3 py-2 text-sm" value={year} onChange={(event) => setYear(event.target.value)} />
        <input aria-label="Depreciation period date" className="rounded-md border border-slate-200 px-3 py-2 text-sm" readOnly value={periodDate} />
        <Chip tone="blue">Asset ที่คิดค่าเสื่อม {data?.period.pendingAssets ?? 0}</Chip>
        <Chip tone="emerald">Run แล้วงวดนี้ {data?.period.postedRuns ?? 0}</Chip>
        <Chip tone="amber">รอ Run {data?.summary.pendingAssets ?? 0}</Chip>
        <span className="flex-1" />
        <ActionButton disabled={isSaving || (data?.summary.pendingAssets ?? 0) === 0} strong onClick={runPreview}>Preview ค่าเสื่อมงวดนี้</ActionButton>
      </FilterPanel>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard label="Asset ที่รอ Run" value={data?.summary.pendingAssets ?? 0} tone="amber" />
        <StatCard label="ประวัติ Dep." value={data?.summary.postedRuns ?? 0} />
        <StatCard label="ค่าเสื่อมรวม" value={formatMoney(data?.summary.totalDepreciation)} tone="red" />
      </div>
      <Panel title="Asset รอ Run ค่าเสื่อม">
        <MiniAssetTable isLoading={isLoading} rows={data?.pendingAssets ?? []} />
      </Panel>
      <TableShell title="Depreciation History">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-100 text-slate-600"><tr><Th>DEP ID</Th><Th>งวด</Th><Th>Asset</Th><Th align="right">Acc ก่อน</Th><Th align="right">ค่าเสื่อมงวด</Th><Th align="right">Acc หลัง</Th><Th align="right">NBV ก่อน</Th><Th align="right">NBV หลัง</Th><Th align="center">สถานะ</Th><Th align="center">action</Th></tr></thead>
          <tbody>
            <LoadingOrEmpty colSpan={10} isLoading={isLoading} rows={data?.rows.length ?? 0} />
            {(data?.rows ?? []).map((row) => (
              <tr key={row.id} className={`border-t border-slate-100 hover:bg-slate-50 ${row.status === 'reversed' ? 'bg-slate-50 opacity-70' : ''}`}>
                <Td><span className="font-mono text-red-700">{row.refNo}</span></Td><Td>{row.period}</Td><Td><div className="font-medium">{row.assetCode}</div><div className="text-slate-400">{row.assetName}</div></Td>
                <Td align="right">{formatMoney(row.accumBefore)}</Td><Td align="right">{formatMoney(row.depreciationAmount)}</Td><Td align="right">{formatMoney(row.accumAfter)}</Td><Td align="right">{formatMoney(row.nbvBefore)}</Td><Td align="right">{formatMoney(row.nbvAfter)}</Td>
                <Td align="center"><Chip tone={row.status === 'reversed' ? 'blue' : 'emerald'}>{row.status}</Chip></Td>
                <Td align="center">{row.status === 'reversed' ? <span className="text-slate-400">{row.reversalReason || '-'}</span> : <button className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50" disabled={isSaving} onClick={() => setReverseRow(row)} type="button">Reverse</button>}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      {preview ? (
        <Modal title={`Preview ค่าเสื่อมงวด ${preview.periodKey}`}>
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <StatCard label="จำนวนรายการ" value={preview.summary.count} />
            <StatCard label="ค่าเสื่อมรวม" value={formatMoney(preview.summary.totalDepreciation)} tone="red" />
            <StatCard label="จะ Fully Depreciated" value={preview.summary.willFullyDepreciate} tone="amber" />
          </div>
          <TableShell>
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-600"><tr><Th>Asset</Th><Th align="right">Acc ก่อน</Th><Th align="right">ค่าเสื่อม</Th><Th align="right">Acc หลัง</Th><Th align="right">NBV หลัง</Th><Th align="center">สถานะหลัง Run</Th></tr></thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.assetId} className="border-t border-slate-100">
                    <Td><div className="font-medium">{row.assetCode}</div><div className="text-slate-400">{row.assetName}</div></Td>
                    <Td align="right">{formatMoney(row.accumBefore)}</Td><Td align="right">{formatMoney(row.depreciationAmount)}</Td><Td align="right">{formatMoney(row.accumAfter)}</Td><Td align="right">{formatMoney(row.nbvAfter)}</Td>
                    <Td align="center">{row.willFullyDepreciate ? <Chip tone="blue">Fully Depreciated</Chip> : <Chip tone="emerald">Active</Chip>}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
          <ModalActions>
            <ActionButton onClick={() => setPreview(null)}>ยกเลิก</ActionButton>
            <ActionButton disabled={isSaving || preview.rows.length === 0} strong onClick={commitRun}>{isSaving ? 'กำลัง Run' : 'Commit Run'}</ActionButton>
          </ModalActions>
        </Modal>
      ) : null}

      {reverseRow ? (
        <Modal title={`Reverse ค่าเสื่อม ${reverseRow.refNo}`}>
          <div className="space-y-3">
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-medium">{reverseRow.assetCode} - {reverseRow.assetName}</div>
              <div>งวด {reverseRow.period} / ค่าเสื่อม {formatMoney(reverseRow.depreciationAmount)} บาท</div>
            </div>
            <Field label="เหตุผลการ Reverse"><textarea className={`${fieldClass} min-h-24`} value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} /></Field>
          </div>
          <ModalActions>
            <ActionButton onClick={() => setReverseRow(null)}>ยกเลิก</ActionButton>
            <ActionButton disabled={isSaving} strong onClick={reverseDepreciation}>{isSaving ? 'กำลัง Reverse' : 'ยืนยัน Reverse'}</ActionButton>
          </ModalActions>
        </Modal>
      ) : null}
    </section>
  )
}

export function AssetDisposalPageClient() {
  const [data, setData] = useState<DisposalPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<DisposalFormState>(blankDisposalForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [modal, setModal] = useState<'create' | 'reverse' | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [reverseRow, setReverseRow] = useState<DisposalPayload['rows'][number] | null>(null)

  const loadData = useCallback(() => {
    setIsLoading(true)
    dailyFetchJson<DisposalPayload>('/api/finance-accounting/asset-disposal')
      .then(setData)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลจำหน่ายทรัพย์สินไม่ได้'))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => loadData(), [loadData])

  const selectedAsset = data?.assetOptions.find((asset) => asset.id === form.assetId)
  const sellingPrice = decimalValue(form.sellingPrice)
  const gainLossPreview = sellingPrice - (selectedAsset?.nbv ?? 0)

  const openCreate = () => {
    setForm(blankDisposalForm())
    setError(null)
    setModal('create')
  }

  const updateForm = (field: keyof DisposalFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const saveDisposal = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const result = await dailyFetchJson<{ payload: DisposalPayload }>('/api/finance-accounting/asset-disposal', {
        body: JSON.stringify({ ...form, sellingPrice }),
        method: 'POST',
      })
      setData(result.payload)
      setModal(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกจำหน่ายทรัพย์สินไม่ได้')
    } finally {
      setIsSaving(false)
    }
  }

  const openReverse = (row: DisposalPayload['rows'][number]) => {
    setReverseRow(row)
    setReverseReason('')
    setModal('reverse')
  }

  const reverseDisposal = async () => {
    if (!reverseRow) return
    setIsSaving(true)
    setError(null)
    try {
      const result = await dailyFetchJson<{ payload: DisposalPayload }>('/api/finance-accounting/asset-disposal', {
        body: JSON.stringify({ action: 'reverse', id: reverseRow.id, reason: reverseReason }),
        method: 'PATCH',
      })
      setData(result.payload)
      setModal(null)
      setReverseRow(null)
      setReverseReason('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Reverse จำหน่ายทรัพย์สินไม่ได้')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      {error ? <ErrorBox message={error} /> : null}
      <FilterPanel>
        <Chip tone="blue">Asset ที่จำหน่ายได้ {data?.summary.activeAssets ?? 0}</Chip>
        <Chip tone="emerald">รายการ approved {data?.summary.disposedRows ?? 0}</Chip>
        <Chip tone="amber">Reverse {data?.summary.reversedRows ?? 0}</Chip>
        <span className="flex-1" />
        <ActionButton strong onClick={openCreate}>+ Disposal</ActionButton>
      </FilterPanel>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="ยอดขาย/Proceeds" value={formatMoney(data?.summary.proceeds)} />
        <StatCard label="Gain/(Loss)" value={formatMoney(data?.summary.gainLoss)} tone={(data?.summary.gainLoss ?? 0) >= 0 ? 'emerald' : 'red'} />
        <StatCard label="Asset พร้อมจำหน่าย" value={data?.summary.activeAssets ?? 0} tone="amber" />
      </div>
      <TableShell>
        <table className="w-full text-xs">
          <thead className="bg-slate-100 text-slate-600"><tr><Th>DISP No.</Th><Th>วันที่</Th><Th>Asset</Th><Th>ประเภท</Th><Th align="right">ราคาขาย</Th><Th align="right">NBV ณ วันที่</Th><Th align="right">Gain/(Loss)</Th><Th>เหตุผล</Th><Th align="center">สถานะ</Th><Th align="center">action</Th></tr></thead>
          <tbody>
            <LoadingOrEmpty colSpan={10} isLoading={isLoading} rows={data?.rows.length ?? 0} emptyText="ยังไม่มีรายการจำหน่ายทรัพย์สิน" />
            {(data?.rows ?? []).map((row) => (
              <tr key={row.id} className={`border-t border-slate-100 hover:bg-slate-50 ${row.status === 'reversed' ? 'bg-slate-50 opacity-70' : ''}`}>
                <Td><span className="font-mono text-slate-700">{row.disposalNo}</span></Td><Td>{row.date}</Td><Td><div className="font-medium">{row.assetCode}</div><div className="text-slate-400">{row.assetName}</div></Td><Td>{row.disposalType}</Td>
                <Td align="right">{formatMoney(row.sellingPrice)}</Td><Td align="right">{formatMoney(row.nbv)}</Td><Td align="right" strong>{formatMoney(row.gainLoss)}</Td><Td>{row.reason || '-'}</Td>
                <Td align="center"><Chip tone={row.status === 'reversed' ? 'blue' : 'emerald'}>{row.status}</Chip></Td>
                <Td align="center">{row.status === 'reversed' ? <span className="text-slate-400">{row.reversalReason || '-'}</span> : <button className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50" disabled={isSaving} onClick={() => openReverse(row)} type="button">Reverse</button>}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      {modal === 'create' ? (
        <Modal title="Asset Disposal">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Asset"><IdOptionSelect blankLabel="-เลือก Asset-" options={data?.assetOptions ?? []} value={form.assetId} onChange={(value) => updateForm('assetId', value)} /></Field>
            <Field label="วันที่"><input className={fieldClass} type="date" value={form.disposalDate} onChange={(event) => updateForm('disposalDate', event.target.value)} /></Field>
            <Field label="ประเภท"><SelectControl options={data?.disposalTypes ?? []} value={form.disposalType} onChange={(value) => updateForm('disposalType', value)} /></Field>
            <MoneyField label="ราคาขาย" value={form.sellingPrice} onChange={(value) => updateForm('sellingPrice', value)} />
            <Field label="ลูกค้า"><OptionSelect blankLabel="ไม่ระบุลูกค้า" options={data?.customerOptions ?? []} value={form.customerId} onChange={(value) => updateForm('customerId', value)} /></Field>
            <Field label="Receipt Ref."><input className={fieldClass} value={form.receiptRefNo} onChange={(event) => updateForm('receiptRefNo', event.target.value)} /></Field>
            <div className="md:col-span-2"><Field label="เหตุผล"><textarea className={`${fieldClass} min-h-20`} value={form.reason} onChange={(event) => updateForm('reason', event.target.value)} /></Field></div>
            <div className="md:col-span-2"><Field label="หมายเหตุ"><textarea className={`${fieldClass} min-h-20`} value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} /></Field></div>
          </div>
          {selectedAsset ? (
            <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              <div>NBV ปัจจุบัน: <span className="font-semibold">{formatMoney(selectedAsset.nbv)}</span></div>
              <div>Gain/(Loss) คาดการณ์: <span className={`font-semibold ${gainLossPreview >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatMoney(gainLossPreview)}</span></div>
            </div>
          ) : null}
          <ModalActions>
            <ActionButton onClick={() => setModal(null)}>ยกเลิก</ActionButton>
            <ActionButton disabled={isSaving || !form.assetId} strong onClick={saveDisposal}>{isSaving ? 'กำลังบันทึก' : 'บันทึก'}</ActionButton>
          </ModalActions>
        </Modal>
      ) : null}

      {modal === 'reverse' && reverseRow ? (
        <Modal title={`Reverse Disposal ${reverseRow.disposalNo}`}>
          <div className="space-y-3">
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-medium">{reverseRow.assetCode} - {reverseRow.assetName}</div>
              <div>{reverseRow.disposalType} / Gain(Loss) {formatMoney(reverseRow.gainLoss)} บาท</div>
            </div>
            <Field label="เหตุผลการ Reverse"><textarea className={`${fieldClass} min-h-24`} value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} /></Field>
          </div>
          <ModalActions>
            <ActionButton onClick={() => setModal(null)}>ยกเลิก</ActionButton>
            <ActionButton disabled={isSaving} strong onClick={reverseDisposal}>{isSaving ? 'กำลัง Reverse' : 'ยืนยัน Reverse'}</ActionButton>
          </ModalActions>
        </Modal>
      ) : null}
    </section>
  )
}

function assetRowToForm(row: AssetRegisterRow): AssetFormState {
  return {
    acquisitionType: row.acquisitionType,
    assetStatus: row.assetStatus,
    branchId: row.branchId,
    category: row.category,
    chassisNo: row.chassisNo,
    code: row.code,
    department: row.department,
    depreciationMethod: row.depreciationMethod,
    engineNo: row.engineNo,
    id: row.id,
    insurancePolicyNo: row.insurancePolicyNo,
    licensePlate: row.licensePlate,
    location: row.location,
    name: row.name,
    netAssetCost: formatInputNumber(row.netAssetCost),
    notes: row.notes,
    originalCost: formatInputNumber(row.originalCost),
    purchaseDate: row.purchaseDate,
    responsiblePerson: row.responsiblePerson,
    salvageValue: formatInputNumber(row.salvageValue),
    serialNo: row.serialNo,
    supplierId: row.supplierId,
    usefulLifeMonths: String(row.usefulLifeMonths || 60),
    vatAmount: formatInputNumber(row.vatAmount),
    warrantyExpireDate: row.warrantyExpireDate,
  }
}

function decimalValue(value: string) {
  const amount = Number(String(value || '').replace(/,/g, ''))
  return Number.isFinite(amount) ? amount : 0
}

function formatInputNumber(value: number) {
  return Number.isFinite(value) && value !== 0 ? String(Number(value.toFixed(2))) : ''
}

function formToPayload(form: AssetFormState | Omit<AssetFormState, 'id'>) {
  return {
    ...form,
    netAssetCost: decimalValue(form.netAssetCost),
    originalCost: decimalValue(form.originalCost),
    salvageValue: decimalValue(form.salvageValue),
    usefulLifeMonths: Number(form.usefulLifeMonths || 0),
    vatAmount: decimalValue(form.vatAmount),
  }
}

function parseAssetImportText(content: string): Omit<AssetFormState, 'id'>[] {
  const delimiter = content.includes('\t') ? '\t' : ','
  const lines = content.split(/\r?\n/).filter((line) => line.trim())
  const headers = splitDelimitedLine(lines[0] ?? '', delimiter).map((header) => header.trim().toLowerCase())
  return lines.slice(1).map((line) => {
    const cells = splitDelimitedLine(line, delimiter)
    const value = (header: string) => {
      const index = headers.indexOf(header)
      return index >= 0 ? (cells[index] ?? '').trim() : ''
    }
    return {
      acquisitionType: value('acquisition_type') || 'Purchased',
      assetStatus: value('asset_status') || 'Active',
      branchId: value('branch_code'),
      category: value('category') || 'Other',
      chassisNo: value('chassis_no'),
      code: value('asset_code').toUpperCase(),
      department: value('department'),
      depreciationMethod: value('depreciation_method') || 'Straight Line',
      engineNo: value('engine_no'),
      insurancePolicyNo: value('insurance_policy_no'),
      licensePlate: value('license_plate'),
      location: value('location'),
      name: value('asset_name'),
      netAssetCost: value('net_asset_cost'),
      notes: value('notes'),
      originalCost: value('original_cost'),
      purchaseDate: value('purchase_date'),
      responsiblePerson: value('responsible_person'),
      salvageValue: value('salvage_value') || '0',
      serialNo: value('serial_no'),
      supplierId: value('supplier_code'),
      usefulLifeMonths: value('useful_life_months') || '60',
      vatAmount: value('vat_amount') || '0',
      warrantyExpireDate: value('warranty_expire_date'),
    }
  })
}

function splitDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}

function Modal({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
      <div className="mt-8 w-full max-w-5xl rounded-md bg-white p-4 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function ModalActions({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">{children}</div>
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="block text-xs font-medium text-slate-600"><span className="mb-1 block">{label}</span>{children}</label>
}

function SelectControl({ onChange, options, value }: { onChange: (value: string) => void; options: string[]; value: string }) {
  return <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
}

function OptionSelect({ blankLabel, onChange, options, value }: { blankLabel: string; onChange: (value: string) => void; options: { code: string; name: string }[]; value: string }) {
  return <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{blankLabel}</option>{options.map((option) => <option key={option.code} value={option.code}>{option.code} - {option.name}</option>)}</select>
}

function IdOptionSelect({ blankLabel, onChange, options, value }: { blankLabel: string; onChange: (value: string) => void; options: { code: string; id: string; name: string }[]; value: string }) {
  return <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{blankLabel}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.code} - {option.name}</option>)}</select>
}

function MoneyField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return <Field label={label}><input className={fieldClass} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} /></Field>
}

function ActionButton({ children, disabled = false, onClick, strong = false }: { children: ReactNode; disabled?: boolean; onClick: () => void; strong?: boolean }) {
  const color = strong ? 'bg-slate-900 text-white hover:bg-slate-700' : 'bg-white text-slate-800 hover:bg-slate-50'
  return <button className={`${color} rounded-md px-3 py-2 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-50`} disabled={disabled} onClick={onClick} type="button">{children}</button>
}

function DisabledButton({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return <button className={`${strong ? 'bg-white text-slate-800' : 'bg-slate-100 text-slate-500'} rounded-md px-3 py-2 text-sm font-medium shadow-sm opacity-60`} disabled type="button">{children}</button>
}

function LinkButton({ children, href }: { children: ReactNode; href: string }) {
  return <a className="rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50" href={href}>{children}</a>
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return <div className="rounded-md bg-white p-4 shadow"><h2 className="mb-3 font-semibold text-slate-900">{title}</h2>{children}</div>
}

function FilterPanel({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 rounded-md bg-white p-3 shadow">{children}</div>
}

function TableShell({ children, title }: { children: ReactNode; title?: string }) {
  return <div className="overflow-hidden rounded-md bg-white shadow">{title ? <h2 className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">{title}</h2> : null}<div className="max-h-[60vh] overflow-auto">{children}</div></div>
}

function StatCard({ label, tone, value }: { label: string; tone?: 'amber' | 'emerald' | 'red'; value: number | string }) {
  const color = tone === 'amber' ? 'text-amber-700' : tone === 'emerald' ? 'text-emerald-700' : tone === 'red' ? 'text-red-700' : 'text-slate-900'
  return <div className="rounded-md bg-white p-4 shadow"><div className="text-xs text-slate-500">{label}</div><div className={`mt-1 text-xl font-bold ${color}`}>{value}</div></div>
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">{label}</div><div className="font-semibold text-slate-900">{value}</div></div>
}

function Bar({ label, max, value }: { label: string; max: number; value: number }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0
  return <div><div className="mb-1 flex justify-between text-xs"><span className="text-slate-600">{label}</span><span className="font-medium text-slate-900">{formatMoney(value)}</span></div><div className="h-2 rounded-md-full bg-slate-100"><div className="h-2 rounded-md-full bg-amber-500" style={{ width: `${width}%` }} /></div></div>
}

function MiniAssetTable({ isLoading, rows }: { isLoading: boolean; rows: DepreciationPayload['pendingAssets'] }) {
  return <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-amber-50 text-amber-800"><tr><Th>รหัส</Th><Th>ชื่อ</Th><Th align="right">Net Cost</Th><Th align="right">Acc Dep ปัจจุบัน</Th><Th align="right">NBV</Th><Th align="right">ค่าเสื่อม/เดือน</Th><Th align="center">สถานะ</Th></tr></thead><tbody><LoadingOrEmpty colSpan={7} isLoading={isLoading} rows={rows.length} />{rows.map((row) => <tr key={row.id} className="border-t border-slate-100"><Td><span className="font-mono">{row.code}</span></Td><Td>{row.name}</Td><Td align="right">{formatMoney(row.netAssetCost)}</Td><Td align="right">{formatMoney(row.accumDep)}</Td><Td align="right">{formatMoney(row.nbv)}</Td><Td align="right">{formatMoney(row.monthlyDep)}</Td><Td align="center"><StatusPill status={row.assetStatus} /></Td></tr>)}</tbody></table></div>
}

function LoadingOrEmpty({ colSpan, emptyText = 'ยังไม่มีข้อมูล', isLoading, rows }: { colSpan: number; emptyText?: string; isLoading: boolean; rows: number }) {
  if (isLoading) return <tr><td className="py-8 text-center text-slate-400" colSpan={colSpan}>กำลังโหลดข้อมูล</td></tr>
  if (rows === 0) return <tr><td className="py-8 text-center text-slate-400" colSpan={colSpan}>{emptyText}</td></tr>
  return null
}

function Th({ align = 'left', children }: { align?: 'center' | 'left' | 'right'; children: ReactNode }) {
  const textAlign = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return <th className={`whitespace-nowrap px-3 py-2 font-semibold ${textAlign}`}>{children}</th>
}

function Td({ align = 'left', children, strong = false }: { align?: 'center' | 'left' | 'right'; children: ReactNode; strong?: boolean }) {
  const textAlign = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return <td className={`whitespace-nowrap px-3 py-2 ${textAlign} ${strong ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{children}</td>
}

function Chip({ children, tone }: { children: ReactNode; tone: 'amber' | 'blue' | 'emerald' }) {
  const color = tone === 'blue' ? 'bg-blue-50 text-blue-700' : tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
  return <span className={`rounded-md-full px-3 py-1 text-xs font-semibold ${color}`}>{children}</span>
}

function StatusPill({ status }: { status: string }) {
  const color = status === 'Active' ? 'bg-emerald-50 text-emerald-700' : status === 'Fully Depreciated' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'
  return <span className={`rounded-md-full px-2 py-1 text-xs font-medium ${color}`}>{status}</span>
}

function EmptyText({ children }: { children: ReactNode }) {
  return <div className="text-sm text-slate-400">{children}</div>
}

function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{message}</div>
}
