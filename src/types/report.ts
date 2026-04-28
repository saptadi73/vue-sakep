export interface ApiResponseHeader {
  ApiType: string
  Status?: string
  ResponseCode: string
  ResponseText: string
  headerdata?: string
}

export interface ReportRow {
  Account: string
  Description: string
  Amount: string | null
  Amount1?: string | null
  PadLeft?: number
}

export interface FinancialApiResponse {
  header: ApiResponseHeader
  data: ReportRow[]
}

export interface FinancialReportResult extends FinancialApiResponse {
  source: 'live' | 'mock'
  note?: string
  debug?: JarApiDebugInfo
}

export interface JarApiDebugInfo {
  endpoint: string
  url: string
  method: 'GET'
  requestHeaders: Record<string, string>
  requestParams: Record<string, string>
  responseStatus?: number
  responseRaw?: string
  responseJson?: unknown
  error?: string
  precheckLogin?: {
    status?: number
    responseRaw?: string
    responseCode?: string
    responseText?: string
    error?: string
  }
}

export interface JarReportRequestParams {
  reqMonth: string
  reqYear: string
  jenis: string
  lokasi: string
}

export interface JarLedgerRequestParams {
  jenis: string
  lokasi: string
  account: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  page: number
  maxRecord: number
}

export interface JarLedgerRow {
  Periode?: string
  Location?: string
  Account?: string
  Description?: string
  jDate?: string
  Note?: string
  Remarks?: string
  Beginning?: string | number
  Debit?: string | number
  Credit?: string | number
  Variant?: string | number
  Balance?: string | number
  fCalc?: string
  [key: string]: unknown
}

export interface JarLedgerApiResponse {
  header: ApiResponseHeader & {
    Page?: string | number
    PageCount?: string | number
    MaxRecordPerPage?: string | number
  }
  data: JarLedgerRow[]
}

export interface JarLedgerResult extends JarLedgerApiResponse {
  source: 'live' | 'mock'
  note?: string
  debug?: JarApiDebugInfo
}

export interface JarJurnalRequestParams {
  jenis: string
  lokasi: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  page: number
  maxRecord: number
  accountFilter?: string
}

export interface JarJurnalRow {
  Periode?: string
  ProjectName?: string
  Location?: string
  jNumber?: string
  jDate?: string
  jtype?: string
  'Supplier/Customer'?: string
  Remarks?: string
  Account?: string
  Description?: string
  Notes?: string
  Line_no?: string | number
  Debit?: string | number
  Credit?: string | number
  Division?: string
  CASHFLOW?: string
  Update_By?: string
  [key: string]: unknown
}

export interface JarJurnalApiResponse {
  header: ApiResponseHeader & {
    Page?: string | number
    PageCount?: string | number
    MaxRecordPerPage?: string | number
  }
  data: JarJurnalRow[]
}

export interface JarJurnalResult extends JarJurnalApiResponse {
  source: 'live' | 'mock'
  note?: string
  debug?: JarApiDebugInfo
}
