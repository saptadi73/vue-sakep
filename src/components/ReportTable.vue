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

const parseAmount = (amount: string | null | undefined) => {
  if (!amount) {
    return 0
  }

  const parsed = Number(amount.replaceAll(',', ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const formatAmount = (amount: string | null) => {
  if (!amount) {
    return '-'
  }

  const parsed = parseAmount(amount)
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 2,
  }).format(parsed)
}

const grandTotal = computed(() => {
  const total = props.rows.reduce((sum, row) => sum + parseAmount(row.Amount), 0)

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 2,
  }).format(total)
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
          v-for="(row, idx) in rows"
          :key="`${row.Account}-${idx}`"
          :class="{ 'section-row': isSection(row), 'clickable-row': isClickable(row) }"
          @click="onRowClick(row)"
        >
          <td>{{ row.Account }}</td>
          <td>
            <span :style="{ paddingLeft: leftPadding(row.PadLeft) }">{{ row.Description }}</span>
          </td>
          <td class="amount-cell">{{ formatAmount(row.Amount) }}</td>
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
