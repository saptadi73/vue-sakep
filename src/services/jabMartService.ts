import {
  mockJarBalanceSheet,
  mockJarJurnalByAccount,
  mockJarLedgerByAccount,
  mockJarProfitLoss,
} from '@/data/mockJarReports'
import type {
  FinancialApiResponse,
  FinancialReportResult,
  JarApiDebugInfo,
  JarJurnalApiResponse,
  JarJurnalRequestParams,
  JarJurnalResult,
  JarLedgerApiResponse,
  JarLedgerRequestParams,
  JarLedgerResult,
  JarReportRequestParams,
  ApiResponseHeader,
  ReportRow,
} from '@/types/report'

const API_BASE_URL = import.meta.env.VITE_JABMART_API_BASE_URL ?? '/api/jabmart'

const DEFAULT_USER = import.meta.env.VITE_JABMART_USER
const DEFAULT_PASSWORD = import.meta.env.VITE_JABMART_PASSWORD

const buildAuthHeader = () => {
  if (!DEFAULT_USER || !DEFAULT_PASSWORD) {
    return undefined
  }

  return `Basic ${window.btoa(`${DEFAULT_USER}:${DEFAULT_PASSWORD}`)}`
}

const createFallbackResult = (
  apiType: string,
  rows: ReportRow[],
  reason: string,
  debug?: JarApiDebugInfo,
): FinancialReportResult => {
  return {
    header: {
      ApiType: apiType,
      ResponseCode: 'MOCK',
      ResponseText: 'Using fallback data',
    },
    data: rows,
    source: 'mock',
    note: reason,
    debug,
  }
}

const maskAuthHeader = (value: string) => {
  if (!value.startsWith('Basic ')) {
    return value
  }

  return 'Basic ***REDACTED***'
}

const buildDebugBase = (
  endpoint: string,
  headers: HeadersInit,
  requestParams: Record<string, string>,
): JarApiDebugInfo => {
  const headerEntries = Object.entries(headers as Record<string, string>).map(([key, value]) => {
    if (key.toLowerCase() === 'authorization') {
      return [key, maskAuthHeader(value)]
    }

    return [key, value]
  })

  return {
    endpoint,
    url: `${API_BASE_URL}/${endpoint}`,
    method: 'GET',
    requestHeaders: Object.fromEntries(headerEntries),
    requestParams,
  }
}

const parseApiJsonSafely = <T>(raw: string): T => {
  try {
    return JSON.parse(raw) as T
  } catch {
    const repaired = raw
      .replace(/"headerdata":\s*}/g, '"headerdata":null}')
      .replace(/"data":\s*}/g, '"data":null}')
    return JSON.parse(repaired) as T
  }
}

const checkJarLogin = async (
  authHeader: string | undefined,
): Promise<{
  ok: boolean
  info: {
    status?: number
    responseRaw?: string
    responseCode?: string
    responseText?: string
    error?: string
  }
}> => {
  if (!authHeader) {
    return {
      ok: false,
      info: {
        error:
          'Authorization header is missing (VITE_JABMART_USER / VITE_JABMART_PASSWORD not set)',
      },
    }
  }

  const headers: HeadersInit = {
    Authorization: authHeader,
    ContentType: 'text/xml; charset=utf-8',
  }

  const info: {
    status?: number
    responseRaw?: string
    responseCode?: string
    responseText?: string
    error?: string
  } = {}

  try {
    const response = await fetch(`${API_BASE_URL}/checklogin`, {
      method: 'GET',
      headers,
    })

    info.status = response.status
    const raw = await response.text()
    info.responseRaw = raw

    const payload = parseApiJsonSafely<{ header?: ApiResponseHeader }>(raw)
    info.responseCode = payload.header?.ResponseCode
    info.responseText = payload.header?.ResponseText

    return {
      ok: payload.header?.ResponseCode === '00',
      info,
    }
  } catch (error) {
    info.error = error instanceof Error ? error.message : 'Unknown checklogin error'
    return {
      ok: false,
      info,
    }
  }
}

const fetchJarReport = async (
  endpoint: 'neraca' | 'labarugi',
  params: JarReportRequestParams,
  fallbackRows: ReportRow[],
): Promise<FinancialReportResult> => {
  const headers: HeadersInit = {
    ContentType: 'text/xml; charset=utf-8',
    ReqMonth: params.reqMonth,
    ReqYear: params.reqYear,
    Jenis: params.jenis,
    Lokasi: params.lokasi,
  }

  const authHeader = buildAuthHeader()
  if (authHeader) {
    headers.Authorization = authHeader
  }

  const debug = buildDebugBase(endpoint, headers, {
    ReqMonth: params.reqMonth,
    ReqYear: params.reqYear,
    Jenis: params.jenis,
    Lokasi: params.lokasi,
  })

  const loginCheck = await checkJarLogin(authHeader)
  debug.precheckLogin = loginCheck.info

  if (!loginCheck.ok) {
    const reason = `Checklogin failed (${loginCheck.info.responseCode ?? 'N/A'} - ${loginCheck.info.responseText ?? loginCheck.info.error ?? 'Unknown'})`
    debug.error = reason
    return createFallbackResult(endpoint, fallbackRows, reason, debug)
  }

  try {
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: 'GET',
      headers,
    })

    debug.responseStatus = response.status
    const raw = await response.text()
    debug.responseRaw = raw

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`)
    }

    const payload = parseApiJsonSafely<FinancialApiResponse>(raw)
    debug.responseJson = payload

    if (!payload || !Array.isArray(payload.data)) {
      throw new Error('Invalid API payload format')
    }

    return {
      ...payload,
      source: 'live',
      debug,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error while loading Jab Mart report'

    debug.error = message

    return createFallbackResult(endpoint, fallbackRows, message, debug)
  }
}

export const fetchJarBalanceSheet = async (
  params: JarReportRequestParams,
): Promise<FinancialReportResult> => {
  return fetchJarReport('neraca', params, mockJarBalanceSheet)
}

export const fetchJarProfitLoss = async (
  params: JarReportRequestParams,
): Promise<FinancialReportResult> => {
  return fetchJarReport('labarugi', params, mockJarProfitLoss)
}

const createLedgerFallbackResult = (
  reason: string,
  account: string,
  debug?: JarApiDebugInfo,
): JarLedgerResult => {
  return {
    header: {
      ApiType: 'ledger',
      ResponseCode: 'MOCK',
      ResponseText: 'Using fallback data',
      Page: 1,
      PageCount: 1,
      MaxRecordPerPage: 1000,
    },
    data: mockJarLedgerByAccount[account] ?? [],
    source: 'mock',
    note: reason,
    debug,
  }
}

export const fetchJarLedger = async (params: JarLedgerRequestParams): Promise<JarLedgerResult> => {
  const ledgerLokasi = ''

  const headers: HeadersInit = {
    ContentType: 'text/xml; charset=utf-8',
    Jenis: params.jenis,
    Lokasi: ledgerLokasi,
    Account: params.account,
    StartDate: params.startDate,
    EndDate: params.endDate,
    Page: String(params.page),
    MaxRecord: String(params.maxRecord),
  }

  const authHeader = buildAuthHeader()
  if (authHeader) {
    headers.Authorization = authHeader
  }

  const debug = buildDebugBase('ledger', headers, {
    Jenis: params.jenis,
    Lokasi: ledgerLokasi,
    Account: params.account,
    StartDate: params.startDate,
    EndDate: params.endDate,
    Page: String(params.page),
    MaxRecord: String(params.maxRecord),
  })

  const loginCheck = await checkJarLogin(authHeader)
  debug.precheckLogin = loginCheck.info

  if (!loginCheck.ok) {
    const reason = `Checklogin failed (${loginCheck.info.responseCode ?? 'N/A'} - ${loginCheck.info.responseText ?? loginCheck.info.error ?? 'Unknown'})`
    debug.error = reason
    return createLedgerFallbackResult(reason, params.account, debug)
  }

  try {
    const response = await fetch(`${API_BASE_URL}/ledger`, {
      method: 'GET',
      headers,
    })

    debug.responseStatus = response.status
    const raw = await response.text()
    debug.responseRaw = raw

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`)
    }

    const payload = parseApiJsonSafely<JarLedgerApiResponse>(raw)
    debug.responseJson = payload

    if (!payload || !Array.isArray(payload.data)) {
      throw new Error('Invalid API payload format')
    }

    return {
      ...payload,
      source: 'live',
      debug,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while loading ledger'
    debug.error = message
    return createLedgerFallbackResult(message, params.account, debug)
  }
}

const createJurnalFallbackResult = (
  reason: string,
  accountFilter?: string,
  debug?: JarApiDebugInfo,
): JarJurnalResult => {
  const fallbackRows = accountFilter
    ? (mockJarJurnalByAccount[accountFilter] ?? [])
    : Object.values(mockJarJurnalByAccount).flat()

  return {
    header: {
      ApiType: 'jurnal',
      ResponseCode: 'MOCK',
      ResponseText: 'Using fallback data',
      Page: 1,
      PageCount: 1,
      MaxRecordPerPage: 1000,
    },
    data: fallbackRows,
    source: 'mock',
    note: reason,
    debug,
  }
}

export const fetchJarJurnal = async (params: JarJurnalRequestParams): Promise<JarJurnalResult> => {
  const headers: HeadersInit = {
    ContentType: 'text/xml; charset=utf-8',
    Jenis: params.jenis,
    Lokasi: params.lokasi,
    StartDate: params.startDate,
    EndDate: params.endDate,
    Page: String(params.page),
    MaxRecord: String(params.maxRecord),
  }

  const authHeader = buildAuthHeader()
  if (authHeader) {
    headers.Authorization = authHeader
  }

  const debug = buildDebugBase('jurnal', headers, {
    Jenis: params.jenis,
    Lokasi: params.lokasi,
    StartDate: params.startDate,
    EndDate: params.endDate,
    Page: String(params.page),
    MaxRecord: String(params.maxRecord),
    AccountFilter: params.accountFilter ?? '',
  })

  const loginCheck = await checkJarLogin(authHeader)
  debug.precheckLogin = loginCheck.info

  if (!loginCheck.ok) {
    const reason = `Checklogin failed (${loginCheck.info.responseCode ?? 'N/A'} - ${loginCheck.info.responseText ?? loginCheck.info.error ?? 'Unknown'})`
    debug.error = reason
    return createJurnalFallbackResult(reason, params.accountFilter, debug)
  }

  try {
    const response = await fetch(`${API_BASE_URL}/jurnal`, {
      method: 'GET',
      headers,
    })

    debug.responseStatus = response.status
    const raw = await response.text()
    debug.responseRaw = raw

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`)
    }

    const payload = parseApiJsonSafely<JarJurnalApiResponse>(raw)
    debug.responseJson = payload

    if (!payload || !Array.isArray(payload.data)) {
      throw new Error('Invalid API payload format')
    }

    const filteredData = params.accountFilter
      ? payload.data.filter((row) => String(row.Account ?? '') === params.accountFilter)
      : payload.data

    return {
      ...payload,
      data: filteredData,
      source: 'live',
      debug,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while loading jurnal'
    debug.error = message
    return createJurnalFallbackResult(message, params.accountFilter, debug)
  }
}
