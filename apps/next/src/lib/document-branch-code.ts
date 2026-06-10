const issuedDocumentBranchCodePattern = /^[A-Z]+(\d{2})\d{4}-\d+$/i

export function branchCodeFromIssuedDocumentNo(documentNo: string | null | undefined) {
  const match = String(documentNo ?? '').trim().match(issuedDocumentBranchCodePattern)
  return match?.[1] ?? null
}

export function branchCodeLabelFromIssuedDocumentNo(documentNo: string | null | undefined) {
  const branchCode = branchCodeFromIssuedDocumentNo(documentNo)
  return branchCode ? `สาขา ${branchCode}` : null
}

export function branchLabelFromDocumentBranch(params: {
  branchName?: string | null
  documentNo?: string | null
}) {
  const branchName = params.branchName?.trim()
  if (branchName) return branchName
  return branchCodeLabelFromIssuedDocumentNo(params.documentNo)
}

export function branchCodeSummaryFromIssuedDocumentNos(documentNos: Array<string | null | undefined>) {
  const branchCodes = Array.from(new Set(documentNos.map(branchCodeFromIssuedDocumentNo).filter(Boolean))).sort()
  if (branchCodes.length === 0) return null
  return `สาขา ${branchCodes.join(', ')}`
}
