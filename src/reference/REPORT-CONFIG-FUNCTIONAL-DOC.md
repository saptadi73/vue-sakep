# Dokumen Fungsional Penyusunan Config Report Konsolidasi

Dokumen ini menjelaskan cara membuat config report konsolidasi secara fungsional, termasuk contoh config JSON dan template kerja berbentuk Excel (CSV yang bisa dibuka di Excel).

## 1. Tujuan Config

Config dipakai untuk:

1. Mendefinisikan entitas sumber data report.
2. Memetakan akun sumber (COA) ke key konsolidasi.
3. Menyusun struktur report tree (header, detail, subtotal, total, derived).
4. Menjalankan eliminasi intercompany.

File utama config JSON yang digunakan aplikasi:

- src/reference/consolidation-config.json

## 2. Komponen Wajib dalam JSON

Struktur wajib:

1. version
2. groupCurrency
3. entities
4. coaMappings
5. reportTree
6. eliminationRules

## 3. Definisi Line Type pada Report Tree

1. header
   Digunakan sebagai judul grup laporan. Biasanya mengelompokkan beberapa detail.

2. detail
   Baris detail yang menerima nilai dari hasil COA mapping.

3. subtotal
   Baris ringkasan untuk sub kelompok. Pada engine saat ini, subtotal akan ikut terakumulasi dari child/own base sesuai struktur tree.

4. total
   Baris total utama di level lebih atas.

5. derived
   Baris hasil rumus, menggunakan field formula.

Catatan formula derived:

- Rumus menggunakan key node lain, dipisah spasi.
- Operator yang digunakan: + dan -
- Contoh valid: revenue + cost_of_sales
- Formula hanya dievaluasi untuk lineType derived.
- Untuk lineType total, nilai sebaiknya berasal dari agregasi child (bukan formula).

## 4. Alur Kerja Penyusunan Config

1. Isi sheet Entities.
2. Isi sheet COA Mappings.
3. Bentuk sheet Report Tree.
4. Tambahkan Elimination Rules jika ada transaksi antar entitas.
5. Ubah ke JSON final.
6. Import ke halaman /consolidation/config atau tempel di Mode JSON.
7. Validasi hasil di /consolidation/preview.

## 5. Aturan Validasi Fungsional

1. Setiap key di reportTree harus unik.
2. parentKey harus mengarah ke key yang ada.
3. Key yang dipakai dalam formula harus ada di reportTree yang sama.
4. section harus konsisten: pnl, balance-sheet, atau trial-balance.
5. sign pada COA mapping hanya 1 atau -1.
6. elimination rule debitKey dan creditKey harus ada di reportTree section yang sama.

## 6. Contoh JSON Config Siap Pakai

Contoh lengkap tersedia di:

- src/reference/templates/report-config-sample.json

Contoh ini mencakup:

1. report tree trial-balance.
2. line type header, detail, subtotal, total, dan derived.
3. contoh formula derived untuk balancing check.

## 7. Template Excel (CSV) untuk Pengisian

Template tersedia di folder:

- src/reference/templates/report-config-excel

Daftar file:

1. 01-entities.csv
2. 02-coa-mappings.csv
3. 03-report-tree.csv
4. 04-elimination-rules.csv

Cara pakai:

1. Buka semua CSV di Excel (masing-masing menjadi sheet terpisah).
2. Lengkapi data sesuai kolom.
3. Konversi ke JSON mengikuti contoh report-config-sample.json.
4. Import JSON final ke aplikasi.

## 8. Mapping Kolom Excel ke JSON

1. 01-entities.csv -> entities[]
2. 02-coa-mappings.csv -> coaMappings[]
3. 03-report-tree.csv -> reportTree[]
4. 04-elimination-rules.csv -> eliminationRules[]

## 9. Laporan Keuangan Konsolidasi (Pasca Config)

Setelah config selesai dan preview divalidasi, tersedia halaman laporan final:

- Route: /consolidation/reports
- Menu sidebar: Konsolidasi > Laporan Keuangan Konsolidasi

Fitur di halaman ini:

1. Wizard Periode: pilih bulan dan tahun, semua laporan menggunakan periode yang sama.
2. Tombol Tampilkan Laporan: menghitung ulang Balance Sheet, Profit & Loss, dan Trial Balance dari config aktif sekaligus.
3. Tab switcher: pindah antar tiga jenis laporan tanpa reload.
4. Kolom laporan: Uraian, Sebelum Eliminasi, Eliminasi, Setelah Eliminasi.
5. Row style per lineType: header, detail, subtotal, total, dan derived ditampilkan berbeda.
6. Tombol Cetak: mencetak laporan aktif menggunakan CSS print.
7. Tombol Export XLS: mengunduh file .xlsx dengan tiga sheet (Balance Sheet, Profit & Loss, Trial Balance) sekaligus.

Nama file XLS yang dihasilkan: Laporan-Konsolidasi-<Bulan>-<Tahun>.xlsx

Setiap sheet berisi:

- Baris judul laporan
- Baris periode
- Header kolom
- Data laporan dengan auto column width

## 10. Checklist Sebelum Go-Live

1. Jalankan preview per section: pnl, balance-sheet, trial-balance.
2. Pastikan unmapped accounts kecil atau nol.
3. Pastikan rule eliminasi hanya aktif untuk key yang relevan.
4. Buka /consolidation/reports, pilih periode, klik Tampilkan Laporan.
5. Verifikasi tiga tab (Balance Sheet, P&L, Trial Balance) sudah menampilkan angka yang benar.
6. Export XLS dan review hasilnya sebelum distribusi.
7. Simpan snapshot JSON per periode pelaporan.
