import {
  mockUspsKanjabungBalanceSheet,
  mockUspsKanjabungProfitLoss,
  mockUspsKanjabungTrialBalance,
} from '@/data/mockUspsKanjabungReports'
import type { ReportRow } from '@/types/report'
import type {
  UspsKanjabungReportDebugInfo,
  UspsKanjabungReportRequestParams,
  UspsKanjabungReportResult,
} from '@/types/usppsKanjabungReport'

const API_BASE_URL = import.meta.env.VITE_USPPS_KANJABUNG_API_BASE_URL ?? '/api/uspps-kanjabung'

const ENDPOINT = `${API_BASE_URL}/kirim/dashkan/get`
const REPORT_REQUEST_TIMEOUT_MS = 30000
const MAX_RETRIES = 1

const isRelativeApiBaseUrl = (value: string) => value.startsWith('/')
const getProdApiConfigError = (): string | null => {
  if (!import.meta.env.PROD) {
    return null
  }

  if (isRelativeApiBaseUrl(API_BASE_URL)) {
    return [
      'Konfigurasi API USPPS-KANJABUNG production belum benar.',
      'Set VITE_USPPS_KANJABUNG_API_BASE_URL ke URL backend/proxy yang menerima POST',
      `(sekarang: ${API_BASE_URL}).`,
    ].join(' ')
  }

  return null
}

const DEFAULT_DEVICE_TERMINAL = import.meta.env.VITE_USPPS_KANJABUNG_DEVICE_TERMINAL ?? ''
const DEFAULT_SIGNATURE = import.meta.env.VITE_USPPS_KANJABUNG_SIGNATURE ?? ''
const DEFAULT_USER = import.meta.env.VITE_USPPS_KANJABUNG_USER ?? 'System'

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
  debug?: UspsKanjabungReportDebugInfo,
): UspsKanjabungReportResult => ({
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

const toReportRows = (rows: unknown[]): ReportRow[] => {
  const normalizedRows = rows.filter(
    (row): row is Record<string, unknown> => row !== null && typeof row === 'object',
  )

  const hasHierarchicalShape = normalizedRows.some(
    (row) => row.section !== undefined || row.nobb !== undefined || row.nosbb !== undefined,
  )

  if (!hasHierarchicalShape) {
    return normalizedRows.map((row) => {
      const account = String(row.nosbb ?? row.nobb ?? row.Account ?? '').trim()
      const description = String(
        row.nmsbb ?? row.nmbb ?? row.Description ?? row.section ?? '',
      ).trim()
      const amount =
        row.saldo !== undefined
          ? formatAmount(row.saldo)
          : row.Amount !== undefined
            ? formatAmount(row.Amount)
            : null

      const padLeft = account ? Math.max(0, Math.min(4, Math.floor((account.length - 1) / 2))) : 0

      return {
        Account: account,
        Description: description,
        Amount: amount,
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
      Amount:
        row.saldo !== undefined
          ? formatAmount(row.saldo)
          : row.Amount !== undefined
            ? formatAmount(row.Amount)
            : null,
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
      return toReportRows(value)
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

const attemptUspsKanjabungFetch = async (
  requestType: string,
  body: Record<string, unknown>,
  debug: UspsKanjabungReportDebugInfo,
  attempt: number,
): Promise<
  | { ok: true; payload: Record<string, unknown>; status: number }
  | { ok: false; error: string; retryable: boolean }
> => {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), REPORT_REQUEST_TIMEOUT_MS)

  debug.requestAttempt = {
    url: ENDPOINT,
    method: 'POST',
    corsMode: 'cors',
    timestampStart: new Date().toISOString(),
    ...(attempt > 0 ? { retryAttempt: attempt } : {}),
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: debug.requestHeaders,
      body: JSON.stringify(body),
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit',
    })
    window.clearTimeout(timeoutId)
    debug.requestAttempt.timestampEnd = new Date().toISOString()
    debug.responseStatus = response.status

    const responseRaw = await response.text()
    debug.responseRaw = responseRaw

    let payload: Record<string, unknown> = {}
    if (responseRaw.trim()) {
      try {
        payload = JSON.parse(responseRaw) as Record<string, unknown>
      } catch {
        return { ok: false, error: 'Respons bukan JSON yang valid', retryable: false }
      }
    }
    debug.responseJson = payload

    if (!response.ok) {
      return { ok: false, error: `API returned status ${response.status}`, retryable: false }
    }

    return { ok: true, payload, status: response.status }
  } catch (error) {
    window.clearTimeout(timeoutId)
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        ok: false,
        error: `Request timeout setelah ${REPORT_REQUEST_TIMEOUT_MS / 1000} detik`,
        retryable: true,
      }
    }
    if (error instanceof TypeError) {
      const msg = (error as Error).message
      return {
        ok: false,
        error: `Network error: ${msg}. Kemungkinan CORS blocked atau server tidak accessible.`,
        retryable: true,
      }
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      retryable: false,
    }
  }
}

const fetchUspsKanjabungReport = async (
  requestType: string,
  params: UspsKanjabungReportRequestParams,
  fallbackRows: ReportRow[],
): Promise<UspsKanjabungReportResult> => {
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
  const debug: UspsKanjabungReportDebugInfo = {
    endpoint: ENDPOINT,
    requestHeaders: {
      'Content-Type': 'application/json',
      'Device-Terminal': DEFAULT_DEVICE_TERMINAL,
      Signature: DEFAULT_SIGNATURE,
    },
    requestPayload: body,
    clientTag: 'uspps-userid-fix-20260518',
  }

  const apiConfigError = getProdApiConfigError()
  if (apiConfigError) {
    debug.error = apiConfigError
    return createFallbackResult(fallbackRows, apiConfigError, debug)
  }

  if (!DEFAULT_SIGNATURE || !DEFAULT_DEVICE_TERMINAL) {
    debug.error =
      'VITE_USPPS_KANJABUNG_SIGNATURE dan/atau VITE_USPPS_KANJABUNG_DEVICE_TERMINAL belum diset. Request tidak dikirim ke API.'
    return createFallbackResult(
      fallbackRows,
      'VITE_USPPS_KANJABUNG_SIGNATURE dan/atau VITE_USPPS_KANJABUNG_DEVICE_TERMINAL belum diset. Silakan tambahkan di file .env.local.',
      debug,
    )
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await attemptUspsKanjabungFetch(requestType, body, debug, attempt)

    if (result.ok) {
      const { payload } = result
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
    }

    if (!result.retryable || attempt >= MAX_RETRIES) {
      debug.error = result.error
      debug.errorType = result.retryable ? 'RetryExhausted' : 'NonRetryable'
      return createFallbackResult(fallbackRows, result.error, debug)
    }

    debug.error = `${result.error} — retrying (${attempt + 1}/${MAX_RETRIES})...`
  }

  debug.error = 'Semua percobaan gagal'
  return createFallbackResult(fallbackRows, 'Semua percobaan gagal', debug)
}

export const fetchUspsKanjabungBalanceSheet = (
  params: UspsKanjabungReportRequestParams,
): Promise<UspsKanjabungReportResult> =>
  fetchUspsKanjabungReport('GetNeracaHarian', params, mockUspsKanjabungBalanceSheet)

export const fetchUspsKanjabungProfitLoss = (
  params: UspsKanjabungReportRequestParams,
): Promise<UspsKanjabungReportResult> =>
  fetchUspsKanjabungReport('GetLabaRugiHarian', params, mockUspsKanjabungProfitLoss)

export const fetchUspsKanjabungTrialBalance = (
  params: UspsKanjabungReportRequestParams,
): Promise<UspsKanjabungReportResult> =>
  fetchUspsKanjabungReport('GetNeracaPercobaan', params, mockUspsKanjabungTrialBalance)
