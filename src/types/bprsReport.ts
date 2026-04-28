import type { ReportRow } from './report'

export interface BprsRequestData01 {
  unit: string
  tgl: string // YYYYMMDD format
}

export interface BprsGlRequestData01 {
  unit: string
  tgl1: string // YYYYMMDD format
  tgl2: string // YYYYMMDD format
  nosbb: string
}

export interface BprsRequestBody {
  request: string
  userid: string
  signature: string
  inptgljam: string // YYYYMMDDHHMMSS format
  data01: BprsRequestData01
}

export interface BprsResponseHeader {
  status: string
  message: string
  [key: string]: unknown
}

export interface BprsApiResponse {
  header: BprsResponseHeader
  data: ReportRow[]
}

export interface BprsReportResult {
  header: BprsResponseHeader
  data: ReportRow[]
  source: 'live' | 'mock'
  note?: string
}

export interface BprsReportRequestParams {
  unit: string
  tgl: string // YYYYMMDD
}

export interface BprsGlRequestParams {
  unit: string
  tgl1: string // YYYYMMDD
  tgl2: string // YYYYMMDD
  nosbb: string
}

export interface BprsGlRow {
  [key: string]: unknown
}

export interface BprsGlDebugInfo {
  endpoint: string
  requestHeaders: Record<string, string>
  requestPayload: Record<string, unknown>
  responseStatus?: number
  responseRaw?: string
  responseJson?: unknown
  error?: string
}

export interface BprsGlResult {
  header: BprsResponseHeader
  data: BprsGlRow[]
  source: 'live' | 'mock'
  note?: string
  debug?: BprsGlDebugInfo
}
