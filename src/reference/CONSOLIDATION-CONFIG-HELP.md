# Help: Update Config JSON Konsolidasi

Dokumen ini adalah versi ringkas untuk menu Help aplikasi pada route `/help/consolidation-config`.

## Tujuan

Membantu user melakukan update config JSON konsolidasi dengan aman melalui UI tabel (spreadsheet-like), sambil tetap mempertahankan format file JSON asli.

## Akses Menu

1. Buka menu **Help** di sidebar.
2. Pilih **Panduan Update Config JSON**.
3. Atau akses langsung route `/help/consolidation-config`.

## Alur Update

1. Buka route `/consolidation/config`.
2. Pilih **Mode Tabel** untuk edit per baris-kolom.
3. Update sheet berikut:
   - Entities
   - COA Mappings
   - Report Tree
   - Elimination Rules
4. Klik **Simpan Config**.
5. Gunakan **Export JSON** untuk backup/commit.
6. Gunakan **Import JSON** jika menerima revisi file dari tim lain.

## Validasi Hasil

1. Buka route `/consolidation/preview`.
2. Klik **Hitung Ulang Preview**.
3. Cek bagian:
   - Line Result
   - Elimination Rules Applied
   - Source Summary
   - Top Unmapped Accounts
   - Suggested Mapping Draft

## Melihat Laporan Keuangan Konsolidasi

Setelah config valid dan preview dikonfirmasi:

1. Buka menu **Konsolidasi > Laporan Keuangan Konsolidasi** atau route `/consolidation/reports`.
2. Pilih **Bulan** dan **Tahun** pada wizard periode.
3. Klik **Tampilkan Laporan**.
4. Gunakan tab untuk berpindah antar **Balance Sheet**, **Profit & Loss**, dan **Trial Balance**.
5. Klik **Export XLS** untuk mengunduh ketiga laporan dalam satu file Excel (3 sheet).
6. Klik **Cetak** untuk mencetak laporan yang sedang aktif.

## Catatan Penting

- Mode Tabel dan Mode JSON selalu sinkron pada draft yang sama.
- Perubahan belum permanen sampai klik **Simpan Config**.
- Untuk perubahan besar, selalu Export JSON sebagai snapshot sebelum update.
- Simpan snapshot JSON setiap periode pelaporan untuk audit trail.

## Catatan BPRS Live

- Untuk entitas `pt-bprs`, source data konsolidasi memakai data live dari API BPRS.
- Akun seperti `0101001` hanya akan muncul jika memang ada pada laporan BPRS live (unit dan tanggal yang sesuai).
- Unit BPRS terakhir yang dipakai di halaman laporan BPRS akan dipakai ulang saat preview/laporan konsolidasi.
- Jika API BPRS gagal, sistem otomatis fallback ke mock data.

Langkah cepat cek akun BPRS belum muncul:

1. Buka halaman laporan BPRS dan pastikan akun muncul di sana.
2. Kembali ke `/consolidation/config`, cek `entityId=pt-bprs` dan `sourceAccount` mapping.
3. Pastikan `consolidationKey` ada di `reportTree` section yang sama.
4. Buka `/consolidation/preview`, lalu klik **Hitung Ulang Preview**.
