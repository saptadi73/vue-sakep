<script setup lang="ts">
import { computed } from 'vue'
import type { JarJurnalRow } from '@/types/report'

const props = withDefaults(
  defineProps<{
    rows: JarJurnalRow[]
    emptyMessage?: string
  }>(),
  {
    emptyMessage: 'Belum ada data jurnal untuk parameter ini.',
  },
)

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
  return { debit, credit }
})
</script>

<template>
  <div class="jurnal-shell">
    <table v-if="rows.length" class="jurnal-table">
      <thead>
        <tr>
          <th>Tanggal</th>
          <th>Nomor Jurnal</th>
          <th>Lokasi</th>
          <th>Akun</th>
          <th>Deskripsi</th>
          <th>Remarks</th>
          <th class="num">Debit</th>
          <th class="num">Credit</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, idx) in rows" :key="`${row.jNumber ?? 'J'}-${idx}`">
          <td>{{ row.jDate ?? '-' }}</td>
          <td>{{ row.jNumber ?? '-' }}</td>
          <td>{{ row.Location ?? '-' }}</td>
          <td>{{ row.Account ?? '-' }}</td>
          <td>{{ row.Description ?? row.Notes ?? '-' }}</td>
          <td>{{ row.Remarks ?? '-' }}</td>
          <td class="num">{{ formatCurrency(row.Debit) }}</td>
          <td class="num">{{ formatCurrency(row.Credit) }}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="6">Total Jurnal</td>
          <td class="num">{{ formatCurrency(totals.debit) }}</td>
          <td class="num">{{ formatCurrency(totals.credit) }}</td>
        </tr>
      </tfoot>
    </table>

    <p v-else class="empty">{{ emptyMessage }}</p>
  </div>
</template>

<style scoped>
.jurnal-shell {
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
}

.jurnal-table {
  width: 100%;
  border-collapse: collapse;
}

.jurnal-table th,
.jurnal-table td {
  border-bottom: 1px solid var(--line-soft);
  padding: 0.7rem;
  font-size: 0.82rem;
  vertical-align: top;
}

.jurnal-table th {
  background: #edf4fd;
  color: #29476e;
  text-transform: uppercase;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
}

.num {
  text-align: right;
  white-space: nowrap;
}

tfoot td {
  background: #12315b;
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
