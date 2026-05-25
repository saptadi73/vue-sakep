import {
  fetchOdooCompanies,
  fetchOdooBalanceSheet,
  fetchOdooProfitLoss,
  fetchOdooTrialBalance,
} from '@/services/odooService'
import odooEntitiesConfigJson from '@/reference/odoo-entities-config.json'
import type { ConsolidationConfig, ConsolidationSection } from '@/types/consolidationConfig'
import type { OdooCompany, OdooReportRequestParams } from '@/types/odoo'
import {
  getStaticConsolidationRows,
  type ConsolidationSourceData,
} from '@/services/consolidationEngineService'
import type { ReportRow } from '@/types/report'

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

const fetchRowsForSection = async (
  section: ConsolidationSection,
  params: OdooReportRequestParams,
): Promise<ReportRow[]> => {
  if (section === 'balance-sheet') {
    return (await fetchOdooBalanceSheet(params)).rows
  }

  if (section === 'pnl') {
    return (await fetchOdooProfitLoss(params)).rows
  }

  return (
    await fetchOdooTrialBalance({
      ...params,
      display_accounts: 'balance_not_zero',
    })
  ).rows
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
        return
      }

      const sectionEntries = await Promise.all(
        sections.map(async (section) => {
          const rows = await fetchRowsForSection(section, {
            ...baseParams,
            company_ids: [company.id],
          })

          return [section, rows] as const
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
          if (entity.source === 'odoo') {
            const company = findOdooCompanyForEntity(entity.id, companies)
            if (!company) {
              return [section, []] as const
            }

            const rows = await fetchRowsForSection(section, {
              ...baseParams,
              company_ids: [company.id],
            })

            return [section, rows] as const
          }

          return [section, getStaticConsolidationRows(entity.id, section)] as const
        }),
      )

      sourceData[entity.id] = Object.fromEntries(sectionEntries)
    }),
  )

  return sourceData
}
