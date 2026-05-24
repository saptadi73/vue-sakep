export interface OdooRpcSuccess<T> {
  status: 'success'
  message?: string
  data: T
}

export interface OdooRpcError {
  status: 'error'
  message?: string
}

export type OdooRpcResponse<T> = OdooRpcSuccess<T> | OdooRpcError

export interface OdooAuthPayload {
  login: string
  password: string
  db: string
}

export interface OdooUserSession {
  uid: number
  session_id?: string
  db: string
  login: string
  name: string
  company_id: number
  company_name: string
  company_ids: number[]
}

export interface OdooCompany {
  id: number
  name: string
  currency_id?: number
}

export interface OdooCompaniesPayload {
  active_company_id: number
  companies: OdooCompany[]
}

export interface OdooDrilldownPayload {
  type?: string
  endpoint?: string
  payload?: Record<string, unknown>
}

export interface OdooReportLine {
  id?: number
  code?: string
  name: string
  type?: string
  level?: number
  balance?: number
  debit?: number
  credit?: number
  ending_debit?: number
  ending_credit?: number
  drilldown?: OdooDrilldownPayload | false
}

export interface OdooReportMeta {
  report_type?: string
  company_ids?: number[]
  company_name?: string
  date_from?: string
  date_to?: string
}

export interface OdooFinancialReportPayload {
  meta?: OdooReportMeta
  currency_id?: number
  lines?: OdooReportLine[]
}

export interface OdooTrialBalancePayload {
  meta?: OdooReportMeta
  lines?: OdooReportLine[]
  retained?: Record<string, unknown>
  subtotal?: Record<string, unknown>
}

export interface OdooReportRequestParams {
  company_id?: number
  company_ids?: number[]
  date_from: string
  date_to: string
  target_move?: 'posted' | 'all'
  display_accounts?: 'all' | 'balance_not_zero'
}

export interface OdooJsonConfigRecord {
  id: number
  name: string
  code: string
  description?: string | null
  company_id?: number | null
  active?: boolean
  sequence?: number
  config?: unknown
}

export interface OdooJsonConfigListPayload {
  items?: OdooJsonConfigRecord[]
  total?: number
  page?: number
  limit?: number
}
