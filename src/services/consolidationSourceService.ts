import {
  fetchBprsBalanceSheet,
  fetchBprsProfitLoss,
  fetchBprsTrialBalance,
} from '@/services/bprsService'
import {
  fetchUspsKanjabungBalanceSheet,
  fetchUspsKanjabungProfitLoss,
  fetchUspsKanjabungTrialBalance,
} from '@/services/usppsKanjabungService'
import {
  fetchOdooCompanies,
  fetchOdooBalanceSheet,
  fetchOdooProfitLoss,
  fetchOdooTrialBalance,
} from '@/services/odooService'
import {
  fetchJarBalanceSheet,
  fetchJarProfitLoss,
  fetchJarTrialBalance,
} from '@/services/jabMartService'
import odooEntitiesConfigJson from '@/reference/odoo-entities-config.json'
import type { ConsolidationConfig, ConsolidationSection } from '@/types/consolidationConfig'
import type { OdooCompany, OdooReportRequestParams } from '@/types/odoo'
import { getStaticConsolidationRows } from '@/services/consolidationEngineService'
import type { ConsolidationSourceData, ConsolidationSourceEntry } from '@/types/consolidationResult'
import type { ReportRow } from '@/types/report'

const BPRS_LAST_SUCCESS_DATE_KEY = 'bprs:last-success-date'
const BPRS_LAST_SELECTED_UNIT_KEY = 'bprs:last-selected-unit'
const DEFAULT_BPRS_UNIT = '00'
const USPPS_LAST_SUCCESS_DATE_KEY = 'uspps-kanjabung:last-success-date'
const USPPS_LAST_SELECTED_UNIT_KEY = 'uspps-kanjabung:last-selected-unit'
const DEFAULT_USPPS_UNIT = '00'
const DEFAULT_JABMART_JENIS = 'Lokasi'
const DEFAULT_JABMART_LOKASI = '620001,620002'

interface OdooEntityConfig {
  routeCode: string
  displayName: string
  roleLabel: string
  nameKeywords: string[]
}

const odooEntitiesConfig = odooEntitiesConfigJson as { entities?: OdooEntityConfig[] }

const normalizeName = (value: string) => value.toLowerCase().replaceAll(/[\s._-]/g, '')

const findByKeywords = (companies: OdooCompany[], keywords: string[]) => {
  return companies.find((company) => {
    const normalizedName = normalizeName(company.name)
    return keywords.some((keyword) => normalizedName.includes(normalizeName(keyword)))
  })
}

export const findOdooCompanyForEntity = (
  entityId: string,
  companies: OdooCompany[],
): OdooCompany | undefined => {
  const configs = Array.isArray(odooEntitiesConfig.entities) ? odooEntitiesConfig.entities : []
  const entityConfig = configs.find((item) => item.routeCode === entityId)
  const byKeyword = entityConfig ? findByKeywords(companies, entityConfig.nameKeywords) : undefined

  if (byKeyword) {
    return byKeyword
  }

  if (entityId === 'kan-jabung') {
    return companies[0]
  }

  if (entityId === 'pt-jgi') {
    const kanJabungConfig = configs.find((item) => item.routeCode === 'kan-jabung')
    const kanJabung = kanJabungConfig
      ? findByKeywords(companies, kanJabungConfig.nameKeywords)
      : companies[0]

    return companies.find((company) => company.id !== kanJabung?.id)
  }

  return undefined
}

export const fetchOdooCompaniesForConsolidation = async (): Promise<OdooCompany[]> => {
  const payload = await fetchOdooCompanies()
  return Array.isArray(payload.companies) ? payload.companies : []
}

const rowsToEntry = (
  rows: ReportRow[],
  sourceLabel: string,
  requestedPeriod: string,
  periodLabel = requestedPeriod,
): ConsolidationSourceEntry => ({
  rows,
  status: rows.length > 0 ? 'live' : 'empty',
  sourceLabel,
  requestedPeriod,
  periodLabel,
  note: rows.length === 0 ? 'API live berhasil dipanggil, tetapi rows kosong.' : undefined,
})

const reportResultToEntry = (
  result: { data: ReportRow[]; source: 'live' | 'mock'; note?: string },
  sourceLabel: string,
  requestedPeriod: string,
  periodLabel = requestedPeriod,
): ConsolidationSourceEntry => ({
  rows: result.data,
  status: result.source === 'live' ? (result.data.length > 0 ? 'live' : 'empty') : 'mock',
  sourceLabel,
  requestedPeriod,
  periodLabel,
  note:
    result.note ??
    (result.source === 'live' && result.data.length === 0
      ? 'API live berhasil dipanggil, tetapi rows kosong.'
      : undefined),
})

const errorToEntry = (
  error: unknown,
  sourceLabel: string,
  requestedPeriod: string,
): ConsolidationSourceEntry => ({
  rows: [],
  status: 'error',
  sourceLabel,
  requestedPeriod,
  periodLabel: requestedPeriod,
  error: error instanceof Error ? error.message : 'Gagal memuat source data.',
})

const fetchOdooEntryForSection = async (
  section: ConsolidationSection,
  params: OdooReportRequestParams,
  company: OdooCompany,
): Promise<ConsolidationSourceEntry> => {
  const sourceLabel = `odoo:${company.name}`

  if (section === 'balance-sheet') {
    return rowsToEntry((await fetchOdooBalanceSheet(params)).rows, sourceLabel, params.date_to)
  }

  if (section === 'pnl') {
    return rowsToEntry((await fetchOdooProfitLoss(params)).rows, sourceLabel, params.date_to)
  }

  const rows = (
    await fetchOdooTrialBalance({
      ...params,
      display_accounts: 'balance_not_zero',
    })
  ).rows

  return rowsToEntry(rows, sourceLabel, params.date_to)
}

const toBprsApiDate = (isoDate: string) => isoDate.replaceAll('-', '')

const toJabMartPeriod = (isoDate: string) => {
  const [year, month] = isoDate.split('-')
  const parsedMonth = Number(month)
  const monthName = Number.isInteger(parsedMonth)
    ? new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
        new Date(Number(year), parsedMonth - 1, 1),
      )
    : new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date())

  return {
    reqMonth: monthName,
    reqYear: year || String(new Date().getFullYear()),
  }
}

const getPreferredBprsDate = (baseParams: OdooReportRequestParams) => {
  if (typeof window === 'undefined') {
    return baseParams.date_to
  }

  return window.localStorage.getItem(BPRS_LAST_SUCCESS_DATE_KEY) ?? baseParams.date_to
}

const getPreferredBprsUnit = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_BPRS_UNIT
  }

  return window.localStorage.getItem(BPRS_LAST_SELECTED_UNIT_KEY) ?? DEFAULT_BPRS_UNIT
}

const fetchBprsRowsForSection = async (
  section: ConsolidationSection,
  baseParams: OdooReportRequestParams,
): Promise<ConsolidationSourceEntry> => {
  const preferredDate = getPreferredBprsDate(baseParams)
  const params = {
    unit: getPreferredBprsUnit(),
    tgl: toBprsApiDate(preferredDate),
  }

  if (section === 'balance-sheet') {
    return reportResultToEntry(await fetchBprsBalanceSheet(params), 'bprs', baseParams.date_to, preferredDate)
  }

  if (section === 'pnl') {
    return reportResultToEntry(await fetchBprsProfitLoss(params), 'bprs', baseParams.date_to, preferredDate)
  }

  return reportResultToEntry(await fetchBprsTrialBalance(params), 'bprs', baseParams.date_to, preferredDate)
}

const getPreferredUsppsDate = (baseParams: OdooReportRequestParams) => {
  if (typeof window === 'undefined') {
    return baseParams.date_to
  }

  return window.localStorage.getItem(USPPS_LAST_SUCCESS_DATE_KEY) ?? baseParams.date_to
}

const getPreferredUsppsUnit = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_USPPS_UNIT
  }

  return window.localStorage.getItem(USPPS_LAST_SELECTED_UNIT_KEY) ?? DEFAULT_USPPS_UNIT
}

const fetchUsppsRowsForSection = async (
  section: ConsolidationSection,
  baseParams: OdooReportRequestParams,
): Promise<ConsolidationSourceEntry> => {
  const preferredDate = getPreferredUsppsDate(baseParams)
  const params = {
    unit: getPreferredUsppsUnit(),
    tgl: toBprsApiDate(preferredDate),
  }

  if (section === 'balance-sheet') {
    return reportResultToEntry(
      await fetchUspsKanjabungBalanceSheet(params),
      'uspps',
      baseParams.date_to,
      preferredDate,
    )
  }

  if (section === 'pnl') {
    return reportResultToEntry(
      await fetchUspsKanjabungProfitLoss(params),
      'uspps',
      baseParams.date_to,
      preferredDate,
    )
  }

  return reportResultToEntry(
    await fetchUspsKanjabungTrialBalance(params),
    'uspps',
    baseParams.date_to,
    preferredDate,
  )
}

const fetchJabMartRowsForSection = async (
  section: ConsolidationSection,
  baseParams: OdooReportRequestParams,
): Promise<ConsolidationSourceEntry> => {
  const period = toJabMartPeriod(baseParams.date_to)
  const periodLabel = `${period.reqMonth} ${period.reqYear}`
  const params = {
    ...period,
    jenis: DEFAULT_JABMART_JENIS,
    lokasi: DEFAULT_JABMART_LOKASI,
  }

  if (section === 'balance-sheet') {
    return reportResultToEntry(await fetchJarBalanceSheet(params), 'jabmart', baseParams.date_to, periodLabel)
  }

  if (section === 'pnl') {
    return reportResultToEntry(await fetchJarProfitLoss(params), 'jabmart', baseParams.date_to, periodLabel)
  }

  return reportResultToEntry(await fetchJarTrialBalance(params), 'jabmart', baseParams.date_to, periodLabel)
}

export const loadOdooConsolidationSourceData = async (
  config: ConsolidationConfig,
  companies: OdooCompany[],
  sections: ConsolidationSection[],
  baseParams: OdooReportRequestParams,
): Promise<ConsolidationSourceData> => {
  const sourceData: ConsolidationSourceData = {}
  const enabledOdooEntities = config.entities.filter(
    (entity) => entity.enabled && entity.source === 'odoo',
  )

  await Promise.all(
    enabledOdooEntities.map(async (entity) => {
      const company = findOdooCompanyForEntity(entity.id, companies)
      if (!company) {
        sourceData[entity.id] = Object.fromEntries(
          sections.map((section) => [
            section,
            {
              rows: [],
              status: 'error',
              sourceLabel: 'odoo',
              requestedPeriod: baseParams.date_to,
              periodLabel: baseParams.date_to,
              error: 'Company Odoo untuk entity ini tidak terdeteksi.',
            } satisfies ConsolidationSourceEntry,
          ]),
        )
        return
      }

      const sectionEntries = await Promise.all(
        sections.map(async (section) => {
          try {
            const entry = await fetchOdooEntryForSection(
              section,
              {
                ...baseParams,
                company_ids: [company.id],
              },
              company,
            )

            return [section, entry] as const
          } catch (error) {
            return [section, errorToEntry(error, `odoo:${company.name}`, baseParams.date_to)] as const
          }
        }),
      )

      sourceData[entity.id] = Object.fromEntries(sectionEntries)
    }),
  )

  return sourceData
}

export const loadConsolidationSourceData = async (
  config: ConsolidationConfig,
  companies: OdooCompany[],
  sections: ConsolidationSection[],
  baseParams: OdooReportRequestParams,
): Promise<ConsolidationSourceData> => {
  const sourceData: ConsolidationSourceData = {}
  const enabledEntities = config.entities.filter((entity) => entity.enabled)

  await Promise.all(
    enabledEntities.map(async (entity) => {
      const sectionEntries = await Promise.all(
        sections.map(async (section) => {
          try {
            if (entity.source === 'odoo') {
              const company = findOdooCompanyForEntity(entity.id, companies)
              if (!company) {
                return [
                  section,
                  {
                    rows: [],
                    status: 'error',
                    sourceLabel: 'odoo',
                    requestedPeriod: baseParams.date_to,
                    periodLabel: baseParams.date_to,
                    error: 'Company Odoo untuk entity ini tidak terdeteksi.',
                  } satisfies ConsolidationSourceEntry,
                ] as const
              }

              const entry = await fetchOdooEntryForSection(
                section,
                {
                  ...baseParams,
                  company_ids: [company.id],
                },
                company,
              )

              return [section, entry] as const
            }

            if (entity.source === 'bprs') {
              return [section, await fetchBprsRowsForSection(section, baseParams)] as const
            }

            if (entity.source === 'uspps') {
              return [section, await fetchUsppsRowsForSection(section, baseParams)] as const
            }

            if (entity.source === 'jabmart') {
              return [section, await fetchJabMartRowsForSection(section, baseParams)] as const
            }

            const rows = getStaticConsolidationRows(entity.id, section)
            return [
              section,
              {
                rows,
                status: rows.length > 0 ? 'static' : 'missing',
                sourceLabel: entity.source,
                requestedPeriod: baseParams.date_to,
                periodLabel: baseParams.date_to,
                note:
                  rows.length > 0
                    ? 'Entity ini belum punya loader API konsolidasi; memakai static rows.'
                    : 'Entity ini belum punya loader API konsolidasi dan static rows kosong.',
              } satisfies ConsolidationSourceEntry,
            ] as const
          } catch (error) {
            return [section, errorToEntry(error, entity.source, baseParams.date_to)] as const
          }
        }),
      )

      sourceData[entity.id] = Object.fromEntries(sectionEntries)
    }),
  )

  return sourceData
}
