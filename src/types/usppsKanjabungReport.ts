import type { ReportRow } from './report'

export interface UspsKanjabungRequestData01 {
  unit: string
  tgl: string // YYYYMMDD format
}

export interface UspsKanjabungRequestBody {
  request: string
  userid: string
  signature: string
  inptgljam: string // YYYYMMDDHHMMSS format
  data01: UspsKanjabungRequestData01
}

export interface UspsKanjabungResponseHeader {
  status: string
  message: string
  [key: string]: unknown
}

export interface UspsKanjabungApiResponse {
  header: UspsKanjabungResponseHeader
  data: ReportRow[]
}

export interface UspsKanjabungReportDebugInfo {
  endpoint: string
  requestHeaders: Record<string, string>
  requestPayload: Record<string, unknown>
  clientTag?: string
  requestAttempt?: {
    url: string
    method: string
    corsMode?: string
    timestampStart?: string
    timestampEnd?: string
  }
  responseStatus?: number
  responseRaw?: string
  responseJson?: unknown
  error?: string
  errorType?: string
}

export interface UspsKanjabungReportResult {
  header: UspsKanjabungResponseHeader
  data: ReportRow[]
  source: 'live' | 'mock'
  note?: string
  debug?: UspsKanjabungReportDebugInfo
}

export interface UspsKanjabungReportRequestParams {
  unit: string
  tgl: string // YYYYMMDD
}
