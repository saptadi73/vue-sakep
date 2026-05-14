import type { ReportRow } from './report'

export interface KanjabungRequestData01 {
  unit: string
  tgl: string // YYYYMMDD format
}

export interface KanjabungRequestBody {
  request: string
  userid: string
  signature: string
  inptgljam: string // YYYYMMDDHHMMSS format
  data01: KanjabungRequestData01
}

export interface KanjabungResponseHeader {
  status: string
  message: string
  [key: string]: unknown
}

export interface KanjabungApiResponse {
  header: KanjabungResponseHeader
  data: ReportRow[]
}

export interface KanjabungReportResult {
  header: KanjabungResponseHeader
  data: ReportRow[]
  source: 'live' | 'mock'
  note?: string
}

export interface KanjabungReportRequestParams {
  unit: string
  tgl: string // YYYYMMDD
}
