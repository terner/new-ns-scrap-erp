'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  emptyMasterDataForm,
  listMasterDataRecords,
  saveMasterDataRecord,
  type MasterDataFormValues,
  type MasterDataRecord,
} from '@/lib/master-data'

type SettingKind = 'vat' | 'wht'

type TaxSettingConfig = {
  apiPath: string
  fallbackName: string
  helper: string
  kind: SettingKind
  label: string
}

type PendingSave = {
  currentValue: number | null
  nextValue: number
  setting: TaxSettingConfig
}

const settings: TaxSettingConfig[] = [
  {
    apiPath: '/api/master-data/vat-settings',
    fallbackName: 'VAT',
    helper: 'ใช้กับบิลซื้อ/ขายที่เลือก VAT',
    kind: 'vat',
    label: 'VAT',
  },
  {
    apiPath: '/api/master-data/wht-settings',
    fallbackName: 'WHT',
    helper: 'ใช้กับรายการหัก ณ ที่จ่าย',
    kind: 'wht',
    label: 'WHT',
  },
]

function selectPrimaryRecord(rows: MasterDataRecord[]) {
  return rows.find((row) => row.active) ?? rows[0] ?? null
}

function toPercentInput(value: number | null) {
  return value === null ? '' : String(value)
}

function toSavePayload(record: MasterDataRecord, value: number, fallbackName: string): MasterDataFormValues {
  return {
    ...emptyMasterDataForm,
    id: record.id,
    name: record.name || fallbackName,
    active: record.active,
    ratePercent: value,
  }
}

export function SystemSettingsPageClient() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null)
  const [records, setRecords] = useState<Record<SettingKind, MasterDataRecord | null>>({ vat: null, wht: null })
  const [savingKind, setSavingKind] = useState<SettingKind | null>(null)
  const [values, setValues] = useState<Record<SettingKind, string>>({ vat: '', wht: '' })

  const cards = useMemo(() => settings.map((setting) => ({
    ...setting,
    record: records[setting.kind],
    value: values[setting.kind],
  })), [records, values])

  async function loadSettings() {
    setError(null)
    setIsLoading(true)
    try {
      const [vatRows, whtRows] = await Promise.all(settings.map((setting) => listMasterDataRecords(setting.apiPath)))
      const nextRecords = {
        vat: selectPrimaryRecord(vatRows),
        wht: selectPrimaryRecord(whtRows),
      }
      setRecords(nextRecords)
      setValues({
        vat: toPercentInput(nextRecords.vat?.ratePercent ?? null),
        wht: toPercentInput(nextRecords.wht?.ratePercent ?? null),
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดค่าตั้งค่าระบบไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [])

  function requestSave(setting: TaxSettingConfig) {
    const record = records[setting.kind]
    if (!record) {
      setError(`ไม่พบข้อมูล ${setting.label} ในระบบ`)
      return
    }

    const nextValue = Number(values[setting.kind])
    if (!Number.isFinite(nextValue) || nextValue < 0 || nextValue > 100) {
      setError(`${setting.label} ต้องเป็นตัวเลข 0-100%`)
      return
    }

    setError(null)
    setPendingSave({
      currentValue: record.ratePercent,
      nextValue,
      setting,
    })
  }

  async function confirmSave() {
    if (!pendingSave) return

    const { nextValue, setting } = pendingSave
    const record = records[setting.kind]
    if (!record) {
      setError(`ไม่พบข้อมูล ${setting.label} ในระบบ`)
      setPendingSave(null)
      return
    }

    setError(null)
    setSavingKind(setting.kind)
    try {
      const saved = await saveMasterDataRecord(setting.apiPath, toSavePayload(record, nextValue, setting.fallbackName))
      setRecords((current) => ({ ...current, [setting.kind]: saved }))
      setValues((current) => ({ ...current, [setting.kind]: toPercentInput(saved.ratePercent) }))
      setPendingSave(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `บันทึก ${setting.label} ไม่ได้`)
    } finally {
      setSavingKind(null)
    }
  }

  return (
    <section className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg bg-white p-5 text-sm text-slate-500 shadow">กำลังโหลดค่าตั้งค่า</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {cards.map((setting) => (
            <section key={setting.kind} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4">
                <h2 className="text-base font-bold text-slate-900">{setting.label}</h2>
                <p className="mt-1 text-xs text-slate-500">{setting.helper}</p>
              </div>

              <label className="block text-sm font-medium text-slate-700">
                อัตรา %
                <div className="mt-1.5 flex max-w-xs items-center overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-slate-700">
                  <input
                    className="w-full px-3 py-2 text-right text-lg font-semibold outline-none"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="0.01"
                    type="number"
                    value={setting.value}
                    onChange={(event) => setValues((current) => ({ ...current, [setting.kind]: event.target.value }))}
                  />
                  <span className="border-l border-slate-200 px-3 text-sm text-slate-500">%</span>
                </div>
              </label>

              <div className="mt-4">
                <button
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                  disabled={!setting.record || savingKind === setting.kind}
                  type="button"
                  onClick={() => requestSave(setting)}
                >
                  {savingKind === setting.kind ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </section>
          ))}
        </div>
      )}

      {pendingSave ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">ยืนยันการเปลี่ยนค่าระบบ</h2>
              <p className="mt-1 text-sm text-slate-600">ค่านี้มีผลกับการคำนวณทั้งระบบ</p>
            </div>

            <div className="space-y-4 px-5 py-4 text-sm">
              <div className="font-semibold text-slate-900">{pendingSave.setting.label}</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">ค่าเดิม</div>
                  <div className="mt-1 text-xl font-bold text-slate-700">{pendingSave.currentValue ?? '-'}%</div>
                </div>
                <div className="rounded-lg bg-amber-50 p-3">
                  <div className="text-xs text-amber-700">ค่าใหม่</div>
                  <div className="mt-1 text-xl font-bold text-amber-800">{pendingSave.nextValue}%</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                disabled={savingKind !== null}
                type="button"
                onClick={() => setPendingSave(null)}
              >
                ยกเลิก
              </button>
              <button
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                disabled={savingKind !== null}
                type="button"
                onClick={() => void confirmSave()}
              >
                {savingKind ? 'กำลังบันทึก...' : 'ยืนยันบันทึก'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
