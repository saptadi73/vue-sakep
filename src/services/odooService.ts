import type { ReportRow } from '@/types/report'
import type {
  OdooAuthPayload,
  OdooCompaniesPayload,
  OdooFinancialReportPayload,
  OdooReportRequestParams,
  OdooRpcResponse,
  OdooTrialBalancePayload,
  OdooUserSession,
} from '@/types/odoo'

const SERVER_URL_STORAGE_KEY = 'odoo:server-url'
const DEFAULT_API_BASE_URL = (import.meta.env.VITE_ODOO_API_BASE_URL ?? '').replace(/\/$/, '')

const normalizeServerUrl = (url: string) => url.trim().replace(/\/$/, '')

export const getOdooServerUrl = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_API_BASE_URL
  }

  const fromStorage = window.localStorage.getItem(SERVER_URL_STORAGE_KEY)
  if (fromStorage && fromStorage.trim() !== '') {
    return normalizeServerUrl(fromStorage)
  }

  return DEFAULT_API_BASE_URL
}

export const setOdooServerUrl = (serverUrl: string) => {
  if (typeof window === 'undefined') {
    return
  }

  const normalized = normalizeServerUrl(serverUrl)
  if (!normalized) {
    window.localStorage.removeItem(SERVER_URL_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(SERVER_URL_STORAGE_KEY, normalized)
}

const buildUrl = (endpoint: string) => {
  const apiBaseUrl = getOdooServerUrl()

  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint
  }

  if (!apiBaseUrl) {
    return endpoint
  }

  return `${apiBaseUrl}${endpoint}`
}

const decimalFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const toAmountString = (value: number | undefined | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null
  }

  return decimalFormatter.format(value)
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  return value as Record<string, unknown>
}

const parseRpcPayload = <T>(payload: unknown): T => {
  const root = asRecord(payload)

  if (!root) {
    throw new Error('Response API Odoo tidak valid: payload bukan objek JSON.')
  }

  // Odoo native JSON-RPC responses are wrapped under `result`.
  const candidate = asRecord(root.result) ?? root

  if (candidate.status === 'error') {
    throw new Error(
      typeof candidate.message === 'string' && candidate.message.trim() !== ''
        ? candidate.message
        : 'Request gagal',
    )
  }

  if (candidate.status === 'success') {
    return (candidate.data ?? candidate.result) as T
  }

  // Handle plain Odoo JSON-RPC errors: { error: { data: { message } } }.
  const rpcError = asRecord(root.error)
  if (rpcError) {
    const errorData = asRecord(rpcError.data)
    const message =
      (typeof errorData?.message === 'string' && errorData.message) ||
      (typeof rpcError.message === 'string' && rpcError.message) ||
      'Request gagal'
    throw new Error(message)
  }

  // If backend returns direct data payload without status wrapper, accept it.
  if (!('status' in candidate)) {
    return candidate as T
  }

  throw new Error('Response API Odoo tidak dikenali.')
}

const postRpc = async <T, P extends object>(endpoint: string, params: P): Promise<T> => {
  const response = await fetch(buildUrl(endpoint), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ params }),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} saat mengakses ${endpoint}`)
  }

  const json = (await response.json()) as OdooRpcResponse<T>
  return parseRpcPayload<T>(json)
}

const toSafeNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null
  }

  return value
}

const normalizeUserSession = (value: unknown, fallbackDb: string): OdooUserSession => {
  if (!value || typeof value !== 'object') {
    throw new Error('Response login Odoo tidak valid: data user tidak ditemukan.')
  }

  const raw = value as Partial<OdooUserSession>
  const companyIds = Array.isArray(raw.company_ids)
    ? raw.company_ids.filter((id): id is number => typeof id === 'number' && !Number.isNaN(id))
    : []

  const companyId = toSafeNumber(raw.company_id) ?? companyIds[0] ?? 0

  return {
    uid: toSafeNumber(raw.uid) ?? 0,
    session_id: typeof raw.session_id === 'string' ? raw.session_id : undefined,
    db: typeof raw.db === 'string' && raw.db.trim() !== '' ? raw.db : fallbackDb,
    login: typeof raw.login === 'string' ? raw.login : '',
    name: typeof raw.name === 'string' ? raw.name : '',
    company_id: companyId,
    company_name: typeof raw.company_name === 'string' ? raw.company_name : '',
    company_ids: companyIds.length ? companyIds : companyId ? [companyId] : [],
  }
}

export const authenticateOdoo = async (payload: OdooAuthPayload): Promise<OdooUserSession> => {
  const rawSession = await postRpc<unknown, OdooAuthPayload>(
    '/api/accounting/authenticate',
    payload,
  )
  return normalizeUserSession(rawSession, payload.db)
}

export const fetchOdooCompanies = async (): Promise<OdooCompaniesPayload> => {
  return postRpc<OdooCompaniesPayload, Record<string, never>>('/api/accounting/companies', {})
}

const mapFinancialLinesToRows = (lines: OdooFinancialReportPayload['lines']): ReportRow[] => {
  if (!Array.isArray(lines)) {
    return []
  }

  return lines.map((line) => ({
    Account: String(line.code ?? ''),
    Description: line.name,
    Amount: toAmountString(line.balance),
    PadLeft: line.level ? Math.max(0, line.level - 1) : 0,
  }))
}

const mapTrialBalanceLinesToRows = (lines: OdooTrialBalancePayload['lines']): ReportRow[] => {
  if (!Array.isArray(lines)) {
    return []
  }

  return lines.map((line) => ({
    Account: String(line.code ?? line.id ?? ''),
    Description: line.name,
    Amount: toAmountString(line.ending_debit ?? line.debit),
    Amount1: toAmountString(line.ending_credit ?? line.credit),
    PadLeft: line.level ? Math.max(0, line.level - 1) : 0,
  }))
}

export const fetchOdooBalanceSheet = async (
  params: OdooReportRequestParams,
): Promise<{
  rows: ReportRow[]
  metaCompanyName: string
}> => {
  const report = await postRpc<OdooFinancialReportPayload, OdooReportRequestParams>(
    '/api/accounting/reports/balance-sheet',
    params,
  )

  return {
    rows: mapFinancialLinesToRows(report.lines),
    metaCompanyName: report.meta?.company_name ?? '-',
  }
}

export const fetchOdooProfitLoss = async (
  params: OdooReportRequestParams,
): Promise<{
  rows: ReportRow[]
  metaCompanyName: string
}> => {
  const report = await postRpc<OdooFinancialReportPayload, OdooReportRequestParams>(
    '/api/accounting/reports/profit-loss',
    params,
  )

  return {
    rows: mapFinancialLinesToRows(report.lines),
    metaCompanyName: report.meta?.company_name ?? '-',
  }
}

export const fetchOdooTrialBalance = async (
  params: OdooReportRequestParams,
): Promise<{
  rows: ReportRow[]
  metaCompanyName: string
}> => {
  const report = await postRpc<OdooTrialBalancePayload, OdooReportRequestParams>(
    '/api/accounting/reports/trial-balance',
    params,
  )

  return {
    rows: mapTrialBalanceLinesToRows(report.lines),
    metaCompanyName: report.meta?.company_name ?? '-',
  }
}
