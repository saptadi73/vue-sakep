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

## Catatan Penting

- Mode Tabel dan Mode JSON selalu sinkron pada draft yang sama.
- Perubahan permanen hanya setelah klik **Simpan Config**.
- Simpan snapshot JSON setiap periode pelaporan untuk audit trail.
