# Template Excel Config Report

Folder ini berisi template CSV yang bisa dibuka di Microsoft Excel.

## File

1. 01-entities.csv
2. 02-coa-mappings.csv
3. 03-report-tree.csv
4. 04-elimination-rules.csv

## Cara Pakai Cepat

1. Buka semua CSV di Excel, masing-masing sebagai sheet terpisah.
2. Isi atau revisi data per sheet.
3. Konversi kembali ke JSON dengan struktur:
   - entities
   - coaMappings
   - reportTree
   - eliminationRules
4. Import JSON final ke halaman /consolidation/config (Mode JSON) lalu klik Simpan Config.

## Catatan

- Kolom formula dipakai terutama untuk lineType derived.
- Gunakan spasi saat menulis formula, contoh: tb_assets_subtotal - tb_total_lex.
- sign pada COA mapping hanya 1 atau -1.
