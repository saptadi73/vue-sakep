<script setup lang="ts">
import { computed } from 'vue'
import type { ReportRow } from '@/types/report'

const props = withDefaults(
  defineProps<{
    rows: ReportRow[]
    emptyMessage?: string
    enableDrilldown?: boolean
  }>(),
  {
    emptyMessage: 'Belum ada data untuk filter yang dipilih.',
    enableDrilldown: false,
  },
)

const emit = defineEmits<{
  (event: 'row-click', row: ReportRow): void
}>()

interface RowWithSummary {
  row: ReportRow
  summaryValue: number | null
}

const parseAmount = (amount: string | null | undefined) => {
  if (!amount) {
    return 0
  }

  const parsed = Number(amount.replaceAll(',', ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 2,
  }).format(amount)
}

const formatAmount = (amount: string | null) => {
  if (!amount) {
    return '-'
  }

  const parsed = parseAmount(amount)
  return formatCurrency(parsed)
}

const rowsWithSummary = computed<RowWithSummary[]>(() => {
  return props.rows.map((row, index) => {
    if (row.Amount) {
      return {
        row,
        summaryValue: parseAmount(row.Amount),
      }
    }

    const currentLevel = row.PadLeft ?? 0
    let sum = 0
    let hasDescendantValue = false

    for (let i = index + 1; i < props.rows.length; i += 1) {
      const candidate = props.rows[i]
      if (!candidate) {
        break
      }

      const candidateLevel = candidate.PadLeft ?? 0

      if (candidateLevel <= currentLevel) {
        break
      }

      if (!candidate.Amount) {
        continue
      }

      sum += parseAmount(candidate.Amount)
      hasDescendantValue = true
    }

    return {
      row,
      summaryValue: hasDescendantValue ? sum : null,
    }
  })
})

const displayAmount = (item: RowWithSummary) => {
  if (item.row.Amount) {
    return formatAmount(item.row.Amount)
  }

  if (item.summaryValue === null) {
    return '-'
  }

  return formatCurrency(item.summaryValue)
}

const grandTotal = computed(() => {
  const total = props.rows.reduce((sum, row) => sum + parseAmount(row.Amount), 0)
  return formatCurrency(total)
})

const leftPadding = (padLeft?: number) => {
  const safePad = Math.min(Math.max(padLeft ?? 0, 0), 8)
  return `${safePad * 14}px`
}

const isSection = (row: ReportRow) => !row.Amount

const isClickable = (row: ReportRow) => {
  return props.enableDrilldown && !isSection(row) && row.Account.trim() !== ''
}

const onRowClick = (row: ReportRow) => {
  if (!isClickable(row)) {
    return
  }

  emit('row-click', row)
}
</script>

<template>
  <div class="report-table-shell">
    <table v-if="rows.length" class="report-table">
      <thead>
        <tr>
          <th>Kode</th>
          <th>Deskripsi Akun</th>
          <th class="amount-cell">Nilai</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(item, idx) in rowsWithSummary"
          :key="`${item.row.Account}-${idx}`"
          :class="{ 'section-row': isSection(item.row), 'clickable-row': isClickable(item.row) }"
          @click="onRowClick(item.row)"
        >
          <td>{{ item.row.Account }}</td>
          <td>
            <span :style="{ paddingLeft: leftPadding(item.row.PadLeft) }">{{
              item.row.Description
            }}</span>
          </td>
          <td class="amount-cell">{{ displayAmount(item) }}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2">Akumulasi Nilai</td>
          <td class="amount-cell">{{ grandTotal }}</td>
        </tr>
      </tfoot>
    </table>

    <p v-else class="empty-state">{{ emptyMessage }}</p>
  </div>
</template>

<style scoped>
.report-table-shell {
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.9);
}

.report-table {
  width: 100%;
  border-collapse: collapse;
}

.report-table th,
.report-table td {
  padding: 0.85rem 1rem;
  font-size: 0.93rem;
  border-bottom: 1px solid var(--line-soft);
}

.report-table th {
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  color: #415575;
  background: #e5edf8;
}

.section-row {
  font-weight: 700;
  background: #f4f8fe;
  color: #0f2a4f;
}

.clickable-row {
  cursor: pointer;
}

.clickable-row:hover {
  background: #eef6ff;
}

.amount-cell {
  text-align: right;
  white-space: nowrap;
}

tfoot td {
  background: #0f2a4f;
  color: #f7fafc;
  font-weight: 700;
}

.empty-state {
  padding: 1.2rem;
  font-size: 0.95rem;
  color: #4f607d;
}
</style>
