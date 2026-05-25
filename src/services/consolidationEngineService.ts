import {
  mockBprsBalanceSheet,
  mockBprsProfitLoss,
  mockBprsTrialBalance,
} from '@/data/mockBprsReports'
import { mockJarBalanceSheet, mockJarProfitLoss, mockJarTrialBalance } from '@/data/mockJarReports'
import {
  mockUspsKanjabungBalanceSheet,
  mockUspsKanjabungProfitLoss,
  mockUspsKanjabungTrialBalance,
} from '@/data/mockUspsKanjabungReports'
import { loadConsolidationConfig } from '@/services/consolidationConfigService'
import type {
  CoaMappingRule,
  ConsolidationConfig,
  ConsolidationNode,
  ConsolidationSection,
} from '@/types/consolidationConfig'
import type {
  ConsolidationEliminationEntry,
  ConsolidationEliminationRuleResult,
  ConsolidationMappingSuggestion,
  ConsolidationPreviewResult,
  ConsolidationPreviewRow,
  ConsolidationSourceData,
  ConsolidationSourceEntry,
  ConsolidationSourceSummary,
  ConsolidationUnmappedEntry,
} from '@/types/consolidationResult'
import type { ReportRow } from '@/types/report'

export type { ConsolidationSourceData, ConsolidationSourceEntry } from '@/types/consolidationResult'

const SOURCE_DATA: Record<string, Record<ConsolidationSection, ReportRow[]>> = {
  'pt-jar': {
    'balance-sheet': mockJarBalanceSheet,
    pnl: mockJarProfitLoss,
    'trial-balance': mockJarTrialBalance,
  },
  'pt-bprs': {
    'balance-sheet': mockBprsBalanceSheet,
    pnl: mockBprsProfitLoss,
    'trial-balance': mockBprsTrialBalance,
  },
  'pt-uspps-kanjabung': {
    'balance-sheet': mockUspsKanjabungBalanceSheet,
    pnl: mockUspsKanjabungProfitLoss,
    'trial-balance': mockUspsKanjabungTrialBalance,
  },
}

export const getStaticConsolidationRows = (
  entityId: string,
  section: ConsolidationSection,
): ReportRow[] => SOURCE_DATA[entityId]?.[section] ?? []

export const getConsolidationSourceEntry = (
  sourceData: ConsolidationSourceData,
  entityId: string,
  section: ConsolidationSection,
): ConsolidationSourceEntry => {
  const value = sourceData[entityId]?.[section]

  if (Array.isArray(value)) {
    return {
      rows: value,
      status: value.length > 0 ? 'live' : 'empty',
      sourceLabel: 'legacy rows',
    }
  }

  if (value) {
    return value
  }

  return {
    rows: [],
    status: 'missing',
    sourceLabel: 'not loaded',
    note: 'Source data belum dimuat untuk entity/section ini.',
  }
}

export const getConsolidationSourceRows = (
  sourceData: ConsolidationSourceData,
  entityId: string,
  section: ConsolidationSection,
): ReportRow[] => getConsolidationSourceEntry(sourceData, entityId, section).rows

const parseAmount = (value: string | null | undefined): number => {
  if (!value) {
    return 0
  }

  const normalized = value
    .replace(/\s/g, '')
    .replace(/\(([^)]+)\)/g, '-$1')
    .replace(/,/g, '')
    .trim()

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const rowToNumber = (row: ReportRow, section: ConsolidationSection): number => {
  if (section === 'trial-balance') {
    return parseAmount(row.Amount) - parseAmount(row.Amount1)
  }

  return parseAmount(row.Amount)
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const accountMatches = (pattern: string, account: string): boolean => {
  const cleanPattern = pattern.trim()
  const cleanAccount = account.trim()

  if (!cleanPattern || !cleanAccount) {
    return false
  }

  if (!cleanPattern.includes('*')) {
    return cleanPattern === cleanAccount
  }

  const regex = new RegExp(`^${escapeRegex(cleanPattern).replace(/\\\*/g, '.*')}$`)
  return regex.test(cleanAccount)
}

const isRowMapped = (mapping: CoaMappingRule, account: string, description: string): boolean => {
  if (!accountMatches(mapping.sourceAccount, account)) {
    return false
  }

  if (!mapping.sourceDescriptionContains) {
    return true
  }

  return description.toLowerCase().includes(mapping.sourceDescriptionContains.toLowerCase())
}

const evaluateFormula = (formula: string, valueMap: Record<string, number>): number => {
  const tokens = formula.split(/\s+/).filter(Boolean)
  let sign = 1
  let total = 0

  for (const token of tokens) {
    if (token === '+') {
      sign = 1
      continue
    }

    if (token === '-') {
      sign = -1
      continue
    }

    total += sign * (valueMap[token] ?? 0)
  }

  return total
}

const computeTreeValues = (
  nodes: ConsolidationNode[],
  baseMap: Record<string, number>,
): Record<string, number> => {
  const sorted = [...nodes].sort((a, b) => a.order - b.order)
  const byParent = new Map<string, ConsolidationNode[]>()

  for (const node of sorted) {
    if (!node.parentKey) {
      continue
    }

    const siblings = byParent.get(node.parentKey) ?? []
    siblings.push(node)
    byParent.set(node.parentKey, siblings)
  }

  const values: Record<string, number> = {}
  const visiting = new Set<string>()

  const resolveValue = (node: ConsolidationNode): number => {
    const existingValue = values[node.key]
    if (existingValue !== undefined) {
      return existingValue
    }

    if (visiting.has(node.key)) {
      return 0
    }

    visiting.add(node.key)

    const children = byParent.get(node.key) ?? []
    const childrenTotal = children.reduce((sum, child) => sum + resolveValue(child), 0)
    const ownBase = baseMap[node.key] ?? 0

    let value = ownBase + childrenTotal

    if (node.lineType === 'derived' && node.formula) {
      value = evaluateFormula(node.formula, { ...values, ...baseMap })
    }

    visiting.delete(node.key)
    values[node.key] = value
    return value
  }

  for (const node of sorted) {
    resolveValue(node)
  }

  return values
}

const applyEliminations = (
  config: ConsolidationConfig,
  section: ConsolidationSection,
  beforeMap: Record<string, number>,
  beforeMapByEntity: Record<string, Record<string, number>>,
): {
  eliminationByKey: Record<string, number>
  eliminations: ConsolidationEliminationEntry[]
  ruleResults: ConsolidationEliminationRuleResult[]
} => {
  const eliminationByKey: Record<string, number> = {}
  const eliminations: ConsolidationEliminationEntry[] = []
  const ruleResults: ConsolidationEliminationRuleResult[] = []

  for (const rule of config.eliminationRules) {
    if (rule.section !== section) {
      continue
    }

    if (!rule.enabled) {
      ruleResults.push({
        ruleId: rule.id,
        ruleName: rule.name,
        enabled: rule.enabled,
        scope: rule.scope,
        entityPair: rule.entityPair,
        debitKey: rule.debitKey,
        creditKey: rule.creditKey,
        debitValue: 0,
        creditValue: 0,
        amount: 0,
        applied: false,
        reason: 'Rule disabled.',
      })
      continue
    }

    let debitValue = beforeMap[rule.debitKey] ?? 0
    let creditValue = beforeMap[rule.creditKey] ?? 0

    if (rule.scope === 'entity-pair') {
      const [debitEntityId, creditEntityId] = rule.entityPair ?? []
      if (!debitEntityId || !creditEntityId) {
        ruleResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          enabled: rule.enabled,
          scope: rule.scope,
          entityPair: rule.entityPair,
          debitKey: rule.debitKey,
          creditKey: rule.creditKey,
          debitValue: 0,
          creditValue: 0,
          amount: 0,
          applied: false,
          reason: 'Entity pair belum lengkap.',
        })
        continue
      }

      debitValue = beforeMapByEntity[debitEntityId]?.[rule.debitKey] ?? 0
      creditValue = beforeMapByEntity[creditEntityId]?.[rule.creditKey] ?? 0
    }

    if (debitValue === 0 || creditValue === 0) {
      ruleResults.push({
        ruleId: rule.id,
        ruleName: rule.name,
        enabled: rule.enabled,
        scope: rule.scope,
        entityPair: rule.entityPair,
        debitKey: rule.debitKey,
        creditKey: rule.creditKey,
        debitValue,
        creditValue,
        amount: 0,
        applied: false,
        reason: 'Debit key atau credit key bernilai 0.',
      })
      continue
    }

    const baseAmount = Math.min(Math.abs(debitValue), Math.abs(creditValue))
    const pct = rule.method === 'percentage' ? (rule.percentage ?? 0) / 100 : 1
    const amount = baseAmount * pct

    if (amount === 0) {
      ruleResults.push({
        ruleId: rule.id,
        ruleName: rule.name,
        enabled: rule.enabled,
        scope: rule.scope,
        entityPair: rule.entityPair,
        debitKey: rule.debitKey,
        creditKey: rule.creditKey,
        debitValue,
        creditValue,
        amount,
        applied: false,
        reason: 'Amount eliminasi 0.',
      })
      continue
    }

    const debitSign = Math.sign(debitValue) || 1
    const creditSign = Math.sign(creditValue) || 1

    eliminationByKey[rule.debitKey] = (eliminationByKey[rule.debitKey] ?? 0) - debitSign * amount
    eliminationByKey[rule.creditKey] = (eliminationByKey[rule.creditKey] ?? 0) - creditSign * amount

    eliminations.push({
      ruleId: rule.id,
      ruleName: rule.name,
      debitKey: rule.debitKey,
      creditKey: rule.creditKey,
      amount,
    })

    ruleResults.push({
      ruleId: rule.id,
      ruleName: rule.name,
      enabled: rule.enabled,
      scope: rule.scope,
      entityPair: rule.entityPair,
      debitKey: rule.debitKey,
      creditKey: rule.creditKey,
      debitValue,
      creditValue,
      amount,
      applied: true,
      reason: 'Applied.',
    })
  }

  return { eliminationByKey, eliminations, ruleResults }
}

const findFirstExistingKey = (candidates: string[], availableKeys: Set<string>): string | null => {
  for (const key of candidates) {
    if (availableKeys.has(key)) {
      return key
    }
  }

  return null
}

const inferSuggestedKey = (
  section: ConsolidationSection,
  account: string,
  description: string,
  availableKeys: Set<string>,
): { key: string | null; confidence: 'high' | 'medium' | 'low'; reason: string } => {
  const acc = account.trim()
  const desc = description.trim().toLowerCase()

  if (section === 'pnl') {
    if (/pendapatan|penjualan|income|revenue/.test(desc) || acc.startsWith('4')) {
      const key = findFirstExistingKey(['rev_external', 'revenue'], availableKeys)
      return {
        key,
        confidence: key ? 'high' : 'low',
        reason: 'Akun/uraian terdeteksi sebagai pendapatan.',
      }
    }

    if (/pokok|hpp|cogs/.test(desc)) {
      const key = findFirstExistingKey(['cogs', 'cost_of_sales'], availableKeys)
      return {
        key,
        confidence: key ? 'high' : 'low',
        reason: 'Uraian mengarah ke beban pokok penjualan.',
      }
    }

    if (/beban|biaya|expense/.test(desc) || acc.startsWith('5') || acc.startsWith('6')) {
      const preferredExpenseKeys =
        acc.startsWith('6') || /operasional|administrasi|umum|selling|marketing/.test(desc)
          ? ['op_expenses', 'operating_expenses', 'cogs', 'cost_of_sales']
          : ['cogs', 'cost_of_sales', 'op_expenses', 'operating_expenses']

      const key = findFirstExistingKey(preferredExpenseKeys, availableKeys)
      return {
        key,
        confidence: key ? 'medium' : 'low',
        reason: 'Akun/uraian terdeteksi sebagai beban.',
      }
    }
  }

  if (section === 'balance-sheet') {
    if (/kas|bank|cash/.test(desc) || /^11/.test(acc)) {
      const key = findFirstExistingKey(['cash_and_bank', 'current_assets'], availableKeys)
      return {
        key,
        confidence: key ? 'high' : 'low',
        reason: 'Akun/uraian terdeteksi sebagai kas dan bank.',
      }
    }

    if (acc.startsWith('1')) {
      const key = findFirstExistingKey(['current_assets'], availableKeys)
      return {
        key,
        confidence: key ? 'medium' : 'low',
        reason: 'Prefix akun 1 diasumsikan aset.',
      }
    }
  }

  if (section === 'trial-balance') {
    if (acc.startsWith('4')) {
      return {
        key: findFirstExistingKey(['rev_external', 'revenue'], availableKeys),
        confidence: 'medium',
        reason: 'Prefix akun 4 pada trial balance diasumsikan pendapatan.',
      }
    }

    if (acc.startsWith('5') || acc.startsWith('6')) {
      const preferredExpenseKeys = acc.startsWith('6')
        ? ['op_expenses', 'operating_expenses', 'cogs', 'cost_of_sales']
        : ['cogs', 'cost_of_sales', 'op_expenses', 'operating_expenses']

      return {
        key: findFirstExistingKey(preferredExpenseKeys, availableKeys),
        confidence: 'medium',
        reason: 'Prefix akun 5/6 pada trial balance diasumsikan beban.',
      }
    }
  }

  const fallback = Array.from(availableKeys)[0] ?? null
  return {
    key: fallback,
    confidence: fallback ? 'low' : 'low',
    reason: 'Tidak ada pola kuat, fallback ke key pertama yang tersedia.',
  }
}

const inferSuggestedSign = (
  section: ConsolidationSection,
  account: string,
  description: string,
): 1 | -1 => {
  const desc = description.toLowerCase()

  if (section === 'pnl') {
    if (
      /beban|biaya|expense|pokok|hpp|cogs/.test(desc) ||
      account.startsWith('5') ||
      account.startsWith('6')
    ) {
      return -1
    }

    return 1
  }

  return 1
}

const buildMappingSuggestions = (
  section: ConsolidationSection,
  config: ConsolidationConfig,
  unmappedEntries: ConsolidationUnmappedEntry[],
): ConsolidationMappingSuggestion[] => {
  const sectionNodes = config.reportTree.filter((node) => node.section === section)
  const nodeByKey = new Map(sectionNodes.map((node) => [node.key, node]))
  const availableKeys = new Set<string>([
    ...sectionNodes.map((node) => node.key),
    ...config.coaMappings
      .filter((mapping) => mapping.section === section)
      .map((mapping) => mapping.consolidationKey),
  ])

  const suggestions: ConsolidationMappingSuggestion[] = []
  const seen = new Set<string>()

  for (const entry of unmappedEntries) {
    const inferred = inferSuggestedKey(section, entry.account, entry.description, availableKeys)
    if (!inferred.key) {
      continue
    }

    const dedupeKey = `${entry.entityId}|${entry.account}|${inferred.key}`
    if (seen.has(dedupeKey)) {
      continue
    }

    seen.add(dedupeKey)

    const node = nodeByKey.get(inferred.key)
    suggestions.push({
      entityId: entry.entityId,
      account: entry.account,
      description: entry.description,
      section,
      suggestedConsolidationKey: inferred.key,
      suggestedParentKey: node?.parentKey,
      suggestedLineType: node?.lineType,
      suggestedSign: inferSuggestedSign(section, entry.account, entry.description),
      confidence: inferred.confidence,
      reason: inferred.reason,
    })

    if (suggestions.length >= 60) {
      break
    }
  }

  return suggestions
}

export const buildConsolidationPreview = (
  section: ConsolidationSection,
  inputConfig?: ConsolidationConfig,
  sourceOverrides: ConsolidationSourceData = {},
): ConsolidationPreviewResult => {
  const config = inputConfig ?? loadConsolidationConfig()
  const enabledEntities = config.entities.filter((entity) => entity.enabled)
  const sectionMappings = config.coaMappings.filter((mapping) => mapping.section === section)

  const mappedAmountByKey: Record<string, number> = {}
  const mappedAmountByEntityKey: Record<string, Record<string, number>> = {}
  const sourceSummary: ConsolidationSourceSummary[] = []
  const unmappedEntries: ConsolidationUnmappedEntry[] = []

  for (const entity of enabledEntities) {
    const sourceEntry = getConsolidationSourceEntry(sourceOverrides, entity.id, section)
    const rows = sourceEntry.rows
    const entityAmountByKey: Record<string, number> = {}
    mappedAmountByEntityKey[entity.id] = entityAmountByKey

    let mappedCount = 0
    let unmappedCount = 0
    let totalMappedAmount = 0

    for (const row of rows) {
      const rawAmount = rowToNumber(row, section)

      if (rawAmount === 0) {
        continue
      }

      const mapping = sectionMappings.find(
        (candidate) =>
          candidate.entityId === entity.id && isRowMapped(candidate, row.Account, row.Description),
      )

      if (!mapping) {
        unmappedCount += 1
        if (unmappedEntries.length < 100) {
          unmappedEntries.push({
            entityId: entity.id,
            account: row.Account,
            description: row.Description,
            rawAmount,
          })
        }
        continue
      }

      const signedAmount = rawAmount * (mapping.sign ?? 1)
      mappedAmountByKey[mapping.consolidationKey] =
        (mappedAmountByKey[mapping.consolidationKey] ?? 0) + signedAmount
      entityAmountByKey[mapping.consolidationKey] =
        (entityAmountByKey[mapping.consolidationKey] ?? 0) + signedAmount
      mappedCount += 1
      totalMappedAmount += signedAmount
    }

    sourceSummary.push({
      entityId: entity.id,
      status: sourceEntry.status,
      sourceLabel: sourceEntry.sourceLabel,
      note: sourceEntry.note ?? sourceEntry.error,
      periodLabel: sourceEntry.periodLabel,
      rowCount: rows.length,
      mappedCount,
      unmappedCount,
      totalMappedAmount,
    })
  }

  const treeNodes = config.reportTree.filter((node) => node.section === section)
  const beforeTree = computeTreeValues(treeNodes, mappedAmountByKey)
  const beforeTreeByEntity = Object.fromEntries(
    Object.entries(mappedAmountByEntityKey).map(([entityId, entityMap]) => [
      entityId,
      computeTreeValues(treeNodes, entityMap),
    ]),
  )
  const { eliminationByKey, eliminations, ruleResults } = applyEliminations(
    config,
    section,
    beforeTree,
    beforeTreeByEntity,
  )

  const afterBase: Record<string, number> = { ...mappedAmountByKey }
  for (const [key, adjustment] of Object.entries(eliminationByKey)) {
    afterBase[key] = (afterBase[key] ?? 0) + adjustment
  }

  const afterTree = computeTreeValues(treeNodes, afterBase)

  const rows: ConsolidationPreviewRow[] = treeNodes
    .map((node) => {
      const amountBefore = beforeTree[node.key] ?? 0
      const amountAfter = afterTree[node.key] ?? 0

      return {
        key: node.key,
        label: node.label,
        section: node.section,
        lineType: node.lineType,
        parentKey: node.parentKey,
        order: node.order,
        amountBefore,
        eliminationAmount: amountAfter - amountBefore,
        amountAfter,
      }
    })
    .sort((a, b) => a.order - b.order)

  const mappingSuggestions = buildMappingSuggestions(section, config, unmappedEntries)

  return {
    section,
    rows,
    sourceSummary,
    eliminations,
    eliminationRuleResults: ruleResults,
    unmappedEntries,
    mappingSuggestions,
  }
}
