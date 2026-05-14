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

export interface UspsKanjabungReportResult {
  header: UspsKanjabungResponseHeader
  data: ReportRow[]
  source: 'live' | 'mock'
  note?: string
}

export interface UspsKanjabungReportRequestParams {
  unit: string
  tgl: string // YYYYMMDD
}
