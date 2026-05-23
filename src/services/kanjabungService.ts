import {
  mockKanjabungBalanceSheet,
  mockKanjabungProfitLoss,
  mockKanjabungTrialBalance,
} from '@/data/mockKanjabungReports'
import type { ReportRow } from '@/types/report'
import type {
  KanjabungApiResponse,
  KanjabungReportRequestParams,
  KanjabungReportResult,
} from '@/types/kanjabungReport'

const API_BASE_URL = import.meta.env.VITE_KANJABUNG_API_BASE_URL ?? '/api/kanjabung'

const ENDPOINT = `${API_BASE_URL}/kirim/dashkan/get`
const REPORT_REQUEST_TIMEOUT_MS = 12000

const isRelativeApiBaseUrl = (value: string) => value.startsWith('/')
const getProdApiConfigError = (): string | null => {
  if (!import.meta.env.PROD) {
    return null
  }

  if (isRelativeApiBaseUrl(API_BASE_URL)) {
    return [
      'Konfigurasi API KANJABUNG production belum benar.',
      'Set VITE_KANJABUNG_API_BASE_URL ke URL backend/proxy yang menerima POST',
      `(sekarang: ${API_BASE_URL}).`,
    ].join(' ')
  }

  return null
}

const DEFAULT_DEVICE_TERMINAL = import.meta.env.VITE_KANJABUNG_DEVICE_TERMINAL ?? ''
const DEFAULT_SIGNATURE = import.meta.env.VITE_KANJABUNG_SIGNATURE ?? ''
const DEFAULT_USER = import.meta.env.VITE_KANJABUNG_USER ?? 'System'

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

const createFallbackResult = (rows: ReportRow[], reason: string): KanjabungReportResult => ({
  header: { status: 'MOCK', message: 'Using fallback data' },
  data: rows,
  source: 'mock',
  note: reason,
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

  const hasHierarchicalKanjabungShape = normalizedRows.some(
    (row) => row.section !== undefined || row.nobb !== undefined || row.nosbb !== undefined,
  )

  if (!hasHierarchicalKanjabungShape) {
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

const fetchKanjabungReport = async (
  requestType: string,
  params: KanjabungReportRequestParams,
  fallbackRows: ReportRow[],
): Promise<KanjabungReportResult> => {
  const apiConfigError = getProdApiConfigError()
  if (apiConfigError) {
    return createFallbackResult(fallbackRows, apiConfigError)
  }

  if (!DEFAULT_SIGNATURE || !DEFAULT_DEVICE_TERMINAL) {
    return createFallbackResult(
      fallbackRows,
      'VITE_KANJABUNG_SIGNATURE dan/atau VITE_KANJABUNG_DEVICE_TERMINAL belum diset. Silakan tambahkan di file .env.local.',
    )
  }

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

  try {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), REPORT_REQUEST_TIMEOUT_MS)

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Device-Terminal': DEFAULT_DEVICE_TERMINAL,
        Signature: DEFAULT_SIGNATURE,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    window.clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`)
    }

    const payload = (await response.json()) as Record<string, unknown>
    const header = buildReportHeader(payload)

    if (!payload || !hasReportArray(requestType, payload)) {
      throw new Error('Format respons API tidak valid')
    }

    const mappedRows = extractReportRows(requestType, payload)

    return {
      header,
      data: mappedRows,
      source: 'live',
      note: mappedRows.length === 0 ? header.message || 'Data Tidak Ditemukan' : undefined,
    }
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? `Request timeout setelah ${REPORT_REQUEST_TIMEOUT_MS / 1000} detik`
        : error instanceof Error
          ? error.message
          : 'Unknown error saat memuat laporan KANJABUNG'

    return createFallbackResult(fallbackRows, message)
  }
}

export const fetchKanjabungBalanceSheet = (
  params: KanjabungReportRequestParams,
): Promise<KanjabungReportResult> =>
  fetchKanjabungReport('GetNeracaHarian', params, mockKanjabungBalanceSheet)

export const fetchKanjabungProfitLoss = (
  params: KanjabungReportRequestParams,
): Promise<KanjabungReportResult> =>
  fetchKanjabungReport('GetLabaRugiHarian', params, mockKanjabungProfitLoss)

export const fetchKanjabungTrialBalance = (
  params: KanjabungReportRequestParams,
): Promise<KanjabungReportResult> =>
  fetchKanjabungReport('GetNeracaPercobaan', params, mockKanjabungTrialBalance)
