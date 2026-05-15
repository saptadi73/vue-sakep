# Consolidation Config Guide

Panduan ini menjelaskan langkah implementasi tahap awal konsolidasi: agregasi lintas entitas, lalu eliminasi.

## Urutan Proses

1. Normalisasi data report dari setiap entitas ke format baris yang seragam.
2. Mapping COA source ke consolidationKey.
3. Agregasi berdasarkan consolidationKey dan periode.
4. Terapkan eliminationRules.
5. Roll-up ke reportTree untuk hasil tampilan final.

## Struktur JSON Wajib

File default berada di src/reference/consolidation-config.json.

Field utama:

- version: versi schema config.
- groupCurrency: mata uang grup.
- entities: daftar entitas sumber data.
- coaMappings: aturan map COA per entitas.
- reportTree: struktur parent-child line report konsolidasi.
- eliminationRules: aturan eliminasi intercompany.

## Cara Edit dari UI Frontend

1. Buka menu Help > Panduan Update Config JSON.
2. Atau akses route help: /help/consolidation-config.
3. Buka menu Konsolidasi > Config Aggregasi & Eliminasi.
4. Route: /consolidation/config.
3. Pilih Mode Tabel untuk edit model baris-kolom seperti spreadsheet.
4. Ubah nilai per sel pada tabel Entities, COA Mappings, Report Tree, dan Elimination Rules.
5. Klik Simpan Config untuk validasi + simpan ke browser localStorage.
6. Gunakan Export JSON untuk backup/commit, dan Import JSON untuk memuat file revisi.
7. Buka menu Konsolidasi > Preview Agregasi & Eliminasi (route: /consolidation/preview).
8. Pilih section report lalu klik Hitung Ulang Preview untuk melihat before/elimination/after.
9. Cek Suggested Mapping Draft untuk akun yang belum termapping.
10. Klik Tambahkan Suggestion ke Config untuk menambahkan draft mapping ke config aktif.

Catatan:

- Mode JSON tetap tersedia untuk edit raw JSON langsung.
- Data pada Mode Tabel dan Mode JSON selalu sinkron pada draft yang sama.
- File aslinya tetap berbentuk JSON saat import/export.

## Apa yang Perlu Ditambahkan oleh Tim

1. Tambah entities sesuai seluruh anak perusahaan yang masuk scope konsolidasi.
2. Lengkapi coaMappings sampai semua akun source penting memiliki consolidationKey.
3. Definisikan reportTree final sesuai format laporan manajemen/audit.
4. Definisikan eliminationRules untuk akun intercompany (piutang-hutang, sales-cogs, dll).
5. Tetapkan convention consolidationKey agar konsisten antar tim.

## Output Preview yang Perlu Dicek

- Line Result: nilai per key sebelum dan sesudah eliminasi.
- Elimination Rules Applied: rule mana saja yang benar-benar terpakai.
- Source Summary: jumlah row termapping vs belum termapping per entitas.
- Top Unmapped Accounts: daftar akun yang masih belum punya rule mapping.
- Suggested Mapping Draft: rekomendasi mapping otomatis berdasarkan prefix akun dan kata kunci deskripsi.

Dokumen ringkas untuk menu Help aplikasi juga tersedia di src/reference/CONSOLIDATION-CONFIG-HELP.md.

## Rekomendasi Governance

- Satu perubahan mapping harus disertai contoh akun sumber dan expected hasil konsolidasi.
- Lakukan review berpasangan untuk perubahan eliminationRules karena berdampak material.
- Simpan snapshot config per periode pelaporan agar rekonsiliasi historis mudah.
