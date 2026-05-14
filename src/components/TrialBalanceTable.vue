<script setup lang="ts">
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

const isClickable = (row: ReportRow) =>
  props.enableDrilldown && (!!row.Amount || !!row.Amount1) && row.Account.trim() !== ''

const onRowClick = (row: ReportRow) => {
  if (!isClickable(row)) return
  emit('row-click', row)
}

const parseAmount = (amount: string | null | undefined) => {
  if (!amount) return 0
  const parsed = Number(amount.replaceAll(',', ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 2,
  }).format(amount)

const formatAmount = (amount: string | null | undefined) => {
  if (!amount) return '-'
  return formatCurrency(parseAmount(amount))
}

const totalDebit = () =>
  formatCurrency(props.rows.reduce((sum, row) => sum + parseAmount(row.Amount), 0))

const totalCredit = () =>
  formatCurrency(props.rows.reduce((sum, row) => sum + parseAmount(row.Amount1), 0))

const leftPadding = (padLeft?: number) => {
  const safePad = Math.min(Math.max(padLeft ?? 0, 0), 8)
  return `${safePad * 14}px`
}
</script>

<template>
  <div class="tb-table-shell">
    <table v-if="rows.length" class="tb-table">
      <thead>
        <tr>
          <th>Kode Akun</th>
          <th>Nama Akun</th>
          <th class="amount-cell">Debit</th>
          <th class="amount-cell">Kredit</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, idx) in rows"
          :key="`${row.Account}-${idx}`"
          :class="{ 'clickable-row': isClickable(row) }"
          @click="onRowClick(row)"
        >
          <td>{{ row.Account }}</td>
          <td>
            <span :style="{ paddingLeft: leftPadding(row.PadLeft) }">{{ row.Description }}</span>
          </td>
          <td class="amount-cell debit-cell">{{ formatAmount(row.Amount) }}</td>
          <td class="amount-cell credit-cell">{{ formatAmount(row.Amount1) }}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2">Total</td>
          <td class="amount-cell">{{ totalDebit() }}</td>
          <td class="amount-cell">{{ totalCredit() }}</td>
        </tr>
      </tfoot>
    </table>

    <p v-else class="empty-state">{{ emptyMessage }}</p>
  </div>
</template>

<style scoped>
.tb-table-shell {
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.9);
}

.tb-table {
  width: 100%;
  border-collapse: collapse;
}

.tb-table th,
.tb-table td {
  padding: 0.85rem 1rem;
  font-size: 0.93rem;
  border-bottom: 1px solid var(--line-soft);
}

.tb-table th {
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  color: #415575;
  background: #e5edf8;
}

.tb-table tfoot td {
  font-weight: 700;
  background: #f4f8fe;
  color: #0f2a4f;
}

.amount-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.debit-cell {
  color: #1a5276;
}

.credit-cell {
  color: #1d6a2e;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: #6b7fa0;
}

.clickable-row {
  cursor: pointer;
}

.clickable-row:hover {
  background: #eaf2ff;
}
</style>
