import type { ReportRow } from '@/types/report'
import type {
  OdooAuthPayload,
  OdooCompaniesPayload,
  OdooFinancialReportPayload,
  OdooJsonConfigListPayload,
  OdooJsonConfigRecord,
  OdooReportRequestParams,
  OdooRpcResponse,
  OdooTrialBalancePayload,
  OdooUserSession,
} from '@/types/odoo'

const SERVER_URL_STORAGE_KEY = 'odoo:server-url'
const DEFAULT_API_BASE_URL = (
  import.meta.env.VITE_ODOO_API_BASE_URL ?? import.meta.env.VITE_ODOO_BASE_URL ?? ''
).replace(/\/$/, '')

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

const asOdooConfigRecord = (value: unknown): OdooJsonConfigRecord | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Partial<OdooJsonConfigRecord>
  if (typeof raw.code !== 'string' || raw.code.trim() === '') {
    return null
  }

  if (typeof raw.name !== 'string' || raw.name.trim() === '') {
    return null
  }

  return {
    id: typeof raw.id === 'number' ? raw.id : 0,
    name: raw.name,
    code: raw.code,
    description: typeof raw.description === 'string' ? raw.description : null,
    company_id: typeof raw.company_id === 'number' ? raw.company_id : null,
    active: typeof raw.active === 'boolean' ? raw.active : true,
    sequence: typeof raw.sequence === 'number' ? raw.sequence : 10,
    config: raw.config,
  }
}

const collectOdooConfigItems = (payload: unknown): OdooJsonConfigRecord[] => {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const root = payload as Record<string, unknown>
  const fromItems = Array.isArray(root.items)
    ? root.items.map(asOdooConfigRecord).filter((item): item is OdooJsonConfigRecord => !!item)
    : []

  if (fromItems.length > 0) {
    return fromItems
  }

  const fromSingle = asOdooConfigRecord(root)
  if (fromSingle) {
    return [fromSingle]
  }

  const nestedCandidates = [root.item, root.record, root.config]
  for (const candidate of nestedCandidates) {
    const normalized = asOdooConfigRecord(candidate)
    if (normalized) {
      return [normalized]
    }
  }

  return []
}

export const fetchOdooJsonConfigByCode = async (
  code: string,
): Promise<OdooJsonConfigRecord | null> => {
  const payload = await postRpc<unknown, { code: string }>('/api/accounting/configs/get', { code })
  const items = collectOdooConfigItems(payload)
  return items[0] ?? null
}

export const listOdooJsonConfigs = async (
  params: {
    company_id?: number | null
    search?: string
    include_inactive?: boolean
    include_config?: boolean
    page?: number
    limit?: number
  } = {},
): Promise<OdooJsonConfigListPayload> => {
  const payload = await postRpc<unknown, typeof params>('/api/accounting/configs', params)
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}

  return {
    items: collectOdooConfigItems(root),
    total: typeof root.total === 'number' ? root.total : undefined,
    page: typeof root.page === 'number' ? root.page : undefined,
    limit: typeof root.limit === 'number' ? root.limit : undefined,
  }
}

export const upsertOdooJsonConfig = async (params: {
  name: string
  code: string
  description?: string
  company_id?: number | null
  sequence?: number
  config: unknown
}): Promise<OdooJsonConfigRecord | null> => {
  const updatePayload = {
    code: params.code,
    config: params.config,
    ...(typeof params.description === 'string' ? { description: params.description } : {}),
    ...(typeof params.sequence === 'number' ? { sequence: params.sequence } : {}),
    ...(typeof params.company_id === 'number' ? { company_id: params.company_id } : {}),
  }

  try {
    const updated = await postRpc<unknown, typeof updatePayload>(
      '/api/accounting/configs/update',
      updatePayload,
    )
    const normalizedUpdated = collectOdooConfigItems(updated)[0]
    if (normalizedUpdated) {
      return normalizedUpdated
    }
  } catch {
    // Fallback to create when config code does not exist yet.
  }

  const createPayload = {
    name: params.name,
    code: params.code,
    company_id: params.company_id ?? null,
    sequence: params.sequence ?? 10,
    config: params.config,
    ...(typeof params.description === 'string' ? { description: params.description } : {}),
  }

  const created = await postRpc<unknown, typeof createPayload>(
    '/api/accounting/configs/create',
    createPayload,
  )
  return collectOdooConfigItems(created)[0] ?? null
}
