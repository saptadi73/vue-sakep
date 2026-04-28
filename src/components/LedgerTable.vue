<script setup lang="ts">
import { computed } from 'vue'
import type { JarLedgerRow } from '@/types/report'

const props = withDefaults(
  defineProps<{
    rows: JarLedgerRow[]
    emptyMessage?: string
    enableDrilldown?: boolean
  }>(),
  {
    emptyMessage: 'Belum ada data ledger untuk akun ini.',
    enableDrilldown: false,
  },
)

const emit = defineEmits<{
  (event: 'row-click', row: JarLedgerRow): void
}>()

const parseNumeric = (value: unknown): number => {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    const cleaned = value.replaceAll(',', '')
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

const formatCurrency = (value: unknown) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 2,
  }).format(parseNumeric(value))
}

const totals = computed(() => {
  const debit = props.rows.reduce((sum, row) => sum + parseNumeric(row.Debit), 0)
  const credit = props.rows.reduce((sum, row) => sum + parseNumeric(row.Credit), 0)
  const lastRow = props.rows.at(-1)
  const ending = parseNumeric(lastRow?.Balance)

  return {
    debit,
    credit,
    ending,
  }
})

const isClickable = (row: JarLedgerRow) => {
  return props.enableDrilldown && Boolean(row.Account) && Boolean(row.jDate)
}

const onRowClick = (row: JarLedgerRow) => {
  if (!isClickable(row)) {
    return
  }

  emit('row-click', row)
}
</script>

<template>
  <div class="ledger-shell">
    <table v-if="rows.length" class="ledger-table">
      <thead>
        <tr>
          <th>Tanggal</th>
          <th>Lokasi</th>
          <th>Keterangan</th>
          <th>Remarks</th>
          <th class="num">Beginning</th>
          <th class="num">Debit</th>
          <th class="num">Credit</th>
          <th class="num">Balance</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, idx) in rows"
          :key="`${row.Account ?? 'A'}-${row.jDate ?? idx}-${idx}`"
          :class="{ 'clickable-row': isClickable(row) }"
          @click="onRowClick(row)"
        >
          <td>{{ row.jDate ?? '-' }}</td>
          <td>{{ row.Location ?? '-' }}</td>
          <td>{{ row.Note ?? row.Description ?? '-' }}</td>
          <td>{{ row.Remarks ?? '-' }}</td>
          <td class="num">{{ formatCurrency(row.Beginning) }}</td>
          <td class="num">{{ formatCurrency(row.Debit) }}</td>
          <td class="num">{{ formatCurrency(row.Credit) }}</td>
          <td class="num">{{ formatCurrency(row.Balance) }}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="5">Total Mutasi</td>
          <td class="num">{{ formatCurrency(totals.debit) }}</td>
          <td class="num">{{ formatCurrency(totals.credit) }}</td>
          <td class="num">{{ formatCurrency(totals.ending) }}</td>
        </tr>
      </tfoot>
    </table>

    <p v-else class="empty">{{ emptyMessage }}</p>
  </div>
</template>

<style scoped>
.ledger-shell {
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
}

.ledger-table {
  width: 100%;
  border-collapse: collapse;
}

.ledger-table th,
.ledger-table td {
  border-bottom: 1px solid var(--line-soft);
  padding: 0.75rem;
  font-size: 0.86rem;
  vertical-align: top;
}

.ledger-table th {
  background: #ecf3fc;
  color: #26456f;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
}

.num {
  text-align: right;
  white-space: nowrap;
}

.clickable-row {
  cursor: pointer;
}

.clickable-row:hover {
  background: #f1f7ff;
}

tfoot td {
  background: #0f2a4f;
  color: #fff;
  font-weight: 700;
}

.empty {
  margin: 0;
  padding: 0.95rem;
  color: #4e6282;
  font-size: 0.9rem;
}
</style>
