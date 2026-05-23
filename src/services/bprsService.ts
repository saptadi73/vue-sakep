import {
  mockBprsBalanceSheet,
  mockBprsProfitLoss,
  mockBprsTrialBalance,
} from '@/data/mockBprsReports'
import type { ReportRow } from '@/types/report'
import type {
  BprsApiResponse,
  BprsGlDebugInfo,
  BprsGlRequestParams,
  BprsGlResult,
  BprsGlRow,
  BprsReportRequestParams,
  BprsReportResult,
} from '@/types/bprsReport'

const API_BASE_URL = import.meta.env.VITE_BPRS_API_BASE_URL ?? '/api/bprs'

const ENDPOINT = `${API_BASE_URL}/kirim/dashkan/get`
const REPORT_REQUEST_TIMEOUT_MS = 12000
const GL_REQUEST_TIMEOUT_MS = 45000

const isRelativeApiBaseUrl = (value: string) => value.startsWith('/')
const getProdApiConfigError = (): string | null => {
  if (!import.meta.env.PROD) {
    return null
  }

  if (isRelativeApiBaseUrl(API_BASE_URL)) {
    return [
      'Konfigurasi API BPRS production belum benar.',
      'Set VITE_BPRS_API_BASE_URL ke URL backend/proxy yang menerima POST',
      `(sekarang: ${API_BASE_URL}).`,
    ].join(' ')
  }

  return null
}

const DEFAULT_USER = import.meta.env.VITE_BPRS_USER ?? 'System'
const DEFAULT_SIGNATURE = import.meta.env.VITE_BPRS_SIGNATURE ?? ''
const DEFAULT_DEVICE = import.meta.env.VITE_BPRS_DEVICE ?? 'Denmas'

const buildTimestamp = (): string => {
  const now = new Date()
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  return (
    String(now.getFullYear()) +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  )
}

const createFallbackResult = (
  rows: ReportRow[],
  reason: string,
  debug?: any,
): BprsReportResult => ({
  header: { status: 'MOCK', message: 'Using fallback data' },
  data: rows,
  source: 'mock',
  note: reason,
  debug,
})

const formatAmount = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) {
    return String(value)
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric)
}

const mapTrialBalanceAmounts = (row: Record<string, unknown>) => {
  const debit =
    row.debet !== undefined
      ? formatAmount(row.debet)
      : row.debit !== undefined
        ? formatAmount(row.debit)
        : row.Amount !== undefined
          ? formatAmount(row.Amount)
          : null

  const credit =
    row.kredit !== undefined
      ? formatAmount(row.kredit)
      : row.credit !== undefined
        ? formatAmount(row.credit)
        : row.Amount1 !== undefined
          ? formatAmount(row.Amount1)
          : null

  return {
    Amount: debit,
    Amount1: credit,
  }
}

const mapSingleAmount = (row: Record<string, unknown>) =>
  row.saldo !== undefined
    ? formatAmount(row.saldo)
    : row.Amount !== undefined
      ? formatAmount(row.Amount)
      : null

const toReportRows = (requestType: string, rows: unknown[]): ReportRow[] => {
  const isTrialBalanceRequest = requestType === 'GetNeracaPercobaan'
  const normalizedRows = rows.filter(
    (row): row is Record<string, unknown> => row !== null && typeof row === 'object',
  )

  const hasHierarchicalBprsShape = normalizedRows.some(
    (row) => row.section !== undefined || row.nobb !== undefined || row.nosbb !== undefined,
  )

  if (!hasHierarchicalBprsShape) {
    return normalizedRows.map((row) => {
      const account = String(row.nosbb ?? row.nobb ?? row.Account ?? '').trim()
      const description = String(
        row.nmsbb ?? row.nmbb ?? row.Description ?? row.section ?? '',
      ).trim()
      const trialBalanceAmounts = isTrialBalanceRequest ? mapTrialBalanceAmounts(row) : null

      const padLeft = account ? Math.max(0, Math.min(4, Math.floor((account.length - 1) / 2))) : 0

      return {
        Account: account,
        Description: description,
        Amount: trialBalanceAmounts?.Amount ?? mapSingleAmount(row),
        Amount1: trialBalanceAmounts?.Amount1,
        PadLeft: padLeft,
      }
    })
  }

  const reportRows: ReportRow[] = []
  let lastSection = ''
  let lastParentAccount = ''

  for (const row of normalizedRows) {
    const section = String(row.section ?? '').trim()
    const parentAccount = String(row.nobb ?? '').trim()
    const parentDescription = String(row.nmbb ?? '').trim()
    const childAccount = String(row.nosbb ?? row.Account ?? '').trim()
    const childDescription = String(row.nmsbb ?? row.Description ?? '').trim()

    if (section && section !== lastSection) {
      reportRows.push({
        Account: String(row.golac ?? '').trim(),
        Description: section,
        Amount: null,
        PadLeft: 0,
      })
      lastSection = section
      lastParentAccount = ''
    }

    if (parentAccount && parentDescription && parentAccount !== lastParentAccount) {
      reportRows.push({
        Account: parentAccount,
        Description: parentDescription,
        Amount: null,
        PadLeft: 1,
      })
      lastParentAccount = parentAccount
    }

    reportRows.push({
      Account: childAccount || parentAccount,
      Description: childDescription || parentDescription || section,
      Amount: isTrialBalanceRequest ? mapTrialBalanceAmounts(row).Amount : mapSingleAmount(row),
      Amount1: isTrialBalanceRequest ? mapTrialBalanceAmounts(row).Amount1 : null,
      PadLeft: 2,
    })
  }

  return reportRows
}

const extractReportRows = (requestType: string, payload: Record<string, unknown>): ReportRow[] => {
  const candidateKeys =
    requestType === 'GetNeracaHarian' || requestType === 'GetNeracaPercobaan'
      ? ['data', 'dataNeraca', 'detail', 'result']
      : ['data', 'dataRugiLaba', 'dataLabaRugi', 'detail', 'result']

  for (const key of candidateKeys) {
    const value = payload[key]
    if (Array.isArray(value)) {
      return toReportRows(requestType, value)
    }
  }

  return []
}

const hasReportArray = (requestType: string, payload: Record<string, unknown>) => {
  const candidateKeys =
    requestType === 'GetNeracaHarian' || requestType === 'GetNeracaPercobaan'
      ? ['data', 'dataNeraca', 'detail', 'result']
      : ['data', 'dataRugiLaba', 'dataLabaRugi', 'detail', 'result']

  return candidateKeys.some((key) => Array.isArray(payload[key]))
}

const buildReportHeader = (payload: Record<string, unknown>) => {
  if (payload.header && typeof payload.header === 'object') {
    const hdr = payload.header as Record<string, unknown>
    return {
      status: String(hdr.status ?? hdr.Status ?? ''),
      message: String(hdr.message ?? hdr.ResponseText ?? ''),
    }
  }

  return {
    status: String(payload.rcode ?? payload.status ?? ''),
    message: String(payload.msg ?? payload.message ?? ''),
  }
}

const fetchBprsReport = async (
  requestType: string,
  params: BprsReportRequestParams,
  fallbackRows: ReportRow[],
): Promise<BprsReportResult> => {
  const apiConfigError = getProdApiConfigError()
  const body = {
    request: requestType,
    userid: DEFAULT_USER,
    signature: DEFAULT_SIGNATURE,
    inptgljam: buildTimestamp(),
    data01: {
      unit: params.unit,
      tgl: params.tgl,
    },
  }
  const debug: any = {
    endpoint: ENDPOINT,
    requestHeaders: {
      'Content-Type': 'application/json',
      'Device-Terminal': DEFAULT_DEVICE,
    },
    requestPayload: body,
  }

  if (apiConfigError) {
    debug.error = apiConfigError
    return createFallbackResult(fallbackRows, apiConfigError, debug)
  }

  if (!DEFAULT_SIGNATURE) {
    debug.error = 'VITE_BPRS_SIGNATURE belum diset. Request tidak dikirim ke API.'
    return createFallbackResult(
      fallbackRows,
      'VITE_BPRS_SIGNATURE belum diset. Silakan tambahkan di file .env.local.',
      debug,
    )
  }

  try {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), REPORT_REQUEST_TIMEOUT_MS)

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: debug.requestHeaders,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    window.clearTimeout(timeoutId)

    debug.responseStatus = response.status
    const responseRaw = await response.text()
    debug.responseRaw = responseRaw

    let payload: Record<string, unknown> = {}
    if (responseRaw.trim()) {
      try {
        payload = JSON.parse(responseRaw) as Record<string, unknown>
      } catch {
        debug.error = 'Respons bukan JSON yang valid'
        return createFallbackResult(fallbackRows, 'Respons bukan JSON yang valid', debug)
      }
    }
    debug.responseJson = payload

    if (!response.ok) {
      debug.error = `API returned status ${response.status}`
      return createFallbackResult(fallbackRows, `API returned status ${response.status}`, debug)
    }

    const header = buildReportHeader(payload)

    if (!payload || !hasReportArray(requestType, payload)) {
      debug.error = 'Format respons API tidak valid'
      return createFallbackResult(fallbackRows, 'Format respons API tidak valid', debug)
    }

    const mappedRows = extractReportRows(requestType, payload)

    return {
      header,
      data: mappedRows,
      source: 'live',
      note: mappedRows.length === 0 ? header.message || 'Data Tidak Ditemukan' : undefined,
      debug,
    }
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? `Request timeout setelah ${REPORT_REQUEST_TIMEOUT_MS / 1000} detik`
        : error instanceof Error
          ? error.message
          : 'Unknown error saat memuat laporan BPRS'
    debug.error = message
    return createFallbackResult(fallbackRows, message, debug)
  }
}

export const fetchBprsBalanceSheet = (params: BprsReportRequestParams): Promise<BprsReportResult> =>
  fetchBprsReport('GetNeracaHarian', params, mockBprsBalanceSheet)

export const fetchBprsProfitLoss = (params: BprsReportRequestParams): Promise<BprsReportResult> =>
  fetchBprsReport('GetLabaRugiHarian', params, mockBprsProfitLoss)

export const fetchBprsTrialBalance = (params: BprsReportRequestParams): Promise<BprsReportResult> =>
  fetchBprsReport('GetNeracaPercobaan', params, mockBprsTrialBalance)

const extractGlRows = (payload: unknown): BprsGlRow[] => {
  if (!payload || typeof payload !== 'object') return []

  const root = payload as Record<string, unknown>
  const candidateKeys = ['HistACC', 'data', 'data01', 'detail', 'rows', 'result']

  for (const key of candidateKeys) {
    const value = root[key]
    if (Array.isArray(value)) {
      return value.filter((item): item is BprsGlRow => item !== null && typeof item === 'object')
    }
  }

  const single = root.data
  if (single && typeof single === 'object' && !Array.isArray(single)) {
    return [single as BprsGlRow]
  }

  return []
}

const buildGlHeader = (payload: Record<string, unknown>) => {
  if (payload.header && typeof payload.header === 'object') {
    const hdr = payload.header as Record<string, unknown>
    return {
      status: String(hdr.status ?? hdr.Status ?? ''),
      message: String(hdr.message ?? hdr.ResponseText ?? ''),
    }
  }

  return {
    status: String(payload.rcode ?? payload.status ?? ''),
    message: String(payload.msg ?? payload.message ?? ''),
  }
}

export const fetchBprsGlHistory = async (params: BprsGlRequestParams): Promise<BprsGlResult> => {
  const apiConfigError = getProdApiConfigError()

  const body = {
    request: 'GetHistACC',
    userid: DEFAULT_USER,
    signature: DEFAULT_SIGNATURE,
    inptgljam: buildTimestamp(),
    data01: {
      unit: params.unit,
      tgl1: params.tgl1,
      tgl2: params.tgl2,
      nosbb: params.nosbb,
    },
  }

  const debug: BprsGlDebugInfo = {
    endpoint: ENDPOINT,
    requestHeaders: {
      'Content-Type': 'application/json',
      'Device-Terminal': DEFAULT_DEVICE,
    },
    requestPayload: body,
  }

  if (!DEFAULT_SIGNATURE) {
    debug.error = 'VITE_BPRS_SIGNATURE belum diset. Request tidak dikirim ke API.'

    return {
      header: { status: 'MOCK', message: 'Using fallback data' },
      data: [],
      source: 'mock',
      note: 'VITE_BPRS_SIGNATURE belum diset. Silakan tambahkan di file .env.local.',
      debug,
    }
  }

  if (apiConfigError) {
    debug.error = apiConfigError

    return {
      header: { status: 'MOCK', message: 'Using fallback data' },
      data: [],
      source: 'mock',
      note: apiConfigError,
      debug,
    }
  }

  try {
    const requestOnce = async () => {
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), GL_REQUEST_TIMEOUT_MS)

      try {
        const response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Device-Terminal': DEFAULT_DEVICE,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        return response
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    let response: Response
    try {
      response = await requestOnce()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Retry once because this endpoint can occasionally be slow/intermittent.
        response = await requestOnce()
      } else {
        throw error
      }
    }

    debug.responseStatus = response.status
    const responseRaw = await response.text()
    debug.responseRaw = responseRaw

    let payload: Record<string, unknown> = {}
    if (responseRaw.trim()) {
      try {
        payload = JSON.parse(responseRaw) as Record<string, unknown>
      } catch {
        throw new Error('Respons GL bukan JSON yang valid')
      }
    }
    debug.responseJson = payload

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`)
    }

    const rows = extractGlRows(payload)
    const header = buildGlHeader(payload)

    return {
      header,
      data: rows,
      source: 'live',
      note: rows.length === 0 ? header.message || 'Data Tidak Ditemukan' : undefined,
      debug,
    }
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? `Request timeout setelah ${GL_REQUEST_TIMEOUT_MS / 1000} detik (sudah retry 1x)`
        : error instanceof Error
          ? error.message
          : 'Unknown error saat memuat GL BPRS'
    debug.error = message

    return {
      header: { status: 'MOCK', message: 'Using fallback data' },
      data: [],
      source: 'mock',
      note: message,
      debug,
    }
  }
}
