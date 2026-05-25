import type { ConsolidationLineType, ConsolidationSection } from '@/types/consolidationConfig'

export interface ConsolidationPreviewRow {
  key: string
  label: string
  section: ConsolidationSection
  lineType: ConsolidationLineType
  parentKey?: string
  order: number
  amountBefore: number
  eliminationAmount: number
  amountAfter: number
}

export interface ConsolidationSourceSummary {
  entityId: string
  rowCount: number
  mappedCount: number
  unmappedCount: number
  totalMappedAmount: number
}

export interface ConsolidationEliminationEntry {
  ruleId: string
  ruleName: string
  debitKey: string
  creditKey: string
  amount: number
}

export interface ConsolidationEliminationRuleResult {
  ruleId: string
  ruleName: string
  enabled: boolean
  scope: 'all' | 'entity-pair'
  entityPair?: [string, string]
  debitKey: string
  creditKey: string
  debitValue: number
  creditValue: number
  amount: number
  applied: boolean
  reason: string
}

export interface ConsolidationUnmappedEntry {
  entityId: string
  account: string
  description: string
  rawAmount: number
}

export interface ConsolidationMappingSuggestion {
  entityId: string
  account: string
  description: string
  section: ConsolidationSection
  suggestedConsolidationKey: string
  suggestedParentKey?: string
  suggestedLineType?: ConsolidationLineType
  suggestedSign: 1 | -1
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

export interface ConsolidationPreviewResult {
  section: ConsolidationSection
  rows: ConsolidationPreviewRow[]
  sourceSummary: ConsolidationSourceSummary[]
  eliminations: ConsolidationEliminationEntry[]
  eliminationRuleResults: ConsolidationEliminationRuleResult[]
  unmappedEntries: ConsolidationUnmappedEntry[]
  mappingSuggestions: ConsolidationMappingSuggestion[]
}
