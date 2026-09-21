# Integrasi SAKep dengan Accounting API Siskab

Dokumen ini menjelaskan kontrak frontend `vue-sakep` dengan Accounting API
Odoo pada Siskab. Dokumentasi struktur payload report yang lebih lengkap berada
di backend:

```text
account_dynamic_reports_jabung/FRONTEND_FINANCE_REPORT_API.md
```

## Environment Production

| Komponen | Nilai |
|---|---|
| Frontend | `https://sakep.kanjabung.com` |
| Odoo API | `https://siskab.kanjabung.com` |
| Database | `odoo_prod` |
| Versi Odoo | `14.0` |
| CORS origin | `https://sakep.kanjabung.com` |

Konfigurasi build production:

```dotenv
VITE_ODOO_BASE_URL=https://siskab.kanjabung.com
VITE_ODOO_DB=odoo_prod
```

## Ketentuan Multi-Database

Siskab melayani lebih dari satu database. Konfigurasi Odoo sengaja memakai
`db_name = False` dan `dbfilter` kosong. Oleh karena itu setiap Accounting API
request harus memiliki query database:

```text
?db=odoo_prod
```

Contoh URL final:

```text
https://siskab.kanjabung.com/api/accounting/authenticate?db=odoo_prod
https://siskab.kanjabung.com/api/accounting/companies?db=odoo_prod
https://siskab.kanjabung.com/api/accounting/configs/get?db=odoo_prod
https://siskab.kanjabung.com/api/accounting/reports/balance-sheet?db=odoo_prod
```

Tanpa query `db`, Odoo belum dapat memilih registry database. Request akan
berakhir dengan 404 sebelum controller Accounting dan middleware CORS dimuat.
Browser kemudian menampilkan 404 sekaligus pesan CORS. Dalam kondisi ini CORS
bukan akar masalahnya.

## Implementasi Frontend

Integrasi terpusat berada di:

```text
src/services/odooService.ts
```

Service tersebut:

1. memakai database dari payload login untuk request autentikasi;
2. menyimpan database yang berhasil digunakan pada `localStorage` dengan key
   `odoo:database`;
3. memulihkan database dari session lama `odoo:auth-session`;
4. memakai `VITE_ODOO_DB` sebagai fallback;
5. menambahkan `?db=...` atau `&db=...` pada seluruh endpoint;
6. mengirim cookie session dengan `credentials: "include"`.

Urutan prioritas database:

```text
odoo:database -> odoo:auth-session.user.db -> VITE_ODOO_DB
```

Urutan prioritas URL server:

```text
odoo:server-url -> VITE_ODOO_API_BASE_URL -> VITE_ODOO_BASE_URL
```

## Format Request

Accounting API memakai route Odoo `type="json"`. Gunakan POST JSON dan session
cookie:

```ts
await fetch(
  'https://siskab.kanjabung.com/api/accounting/companies?db=odoo_prod',
  {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ params: {} }),
  },
)
```

Login tetap mengirim database di payload dan URL:

```json
{
  "params": {
    "db": "odoo_prod",
    "login": "user@example.com",
    "password": "secret"
  }
}
```

Password tidak boleh disimpan di `localStorage` atau `sessionStorage`. Browser
menyimpan session Odoo melalui cookie `HttpOnly`; frontend hanya menyimpan data
user, server URL, dan nama database.

## Endpoint Accounting

Semua path berikut memakai POST dan wajib ditambahkan `?db=<database>`:

| Path | Fungsi |
|---|---|
| `/api/accounting/authenticate` | Membuat session Odoo |
| `/api/accounting/companies` | Mengambil company user |
| `/api/accounting/reports/balance-sheet` | Balance Sheet |
| `/api/accounting/reports/profit-loss` | Profit and Loss |
| `/api/accounting/reports/trial-balance` | Trial Balance |
| `/api/accounting/reports/general-ledger` | General Ledger |
| `/api/accounting/journal-entry` | Detail jurnal |
| `/api/accounting/configs` | Daftar config konsolidasi |
| `/api/accounting/configs/get` | Mengambil config berdasarkan ID/code |
| `/api/accounting/configs/create` | Membuat config |
| `/api/accounting/configs/update` | Memperbarui config |
| `/api/accounting/configs/delete` | Archive/hapus config |

## CORS

Backend mengizinkan origin production berikut:

```text
Access-Control-Allow-Origin: https://sakep.kanjabung.com
Access-Control-Allow-Credentials: true
```

Preflight `OPTIONS` harus memakai URL yang juga memuat query database. Header
CORS tidak dapat diperbaiki dari JavaScript frontend.

## Troubleshooting

| Gejala | Penyebab umum | Tindakan |
|---|---|---|
| `404` dan pesan CORS bersamaan | Query `db` tidak ada | Pastikan Network URL memiliki `?db=odoo_prod` |
| `Odoo Session Expired` | Cookie tidak dikirim atau session habis | Pastikan `credentials: "include"`, lalu login ulang |
| `Failed to fetch` | Origin, DNS, TLS, atau jaringan | Periksa request `OPTIONS` dan response header |
| Response 200 tetapi parsing gagal | URL mengarah ke frontend SAKep, bukan Siskab | Periksa `VITE_ODOO_BASE_URL` dan `odoo:server-url` |
| Masih memakai URL lama | Nilai localStorage lama | Logout/login; bila perlu hapus `odoo:server-url` |

Checklist DevTools:

1. Buka `F12 -> Network`.
2. Pastikan request menuju `siskab.kanjabung.com`, bukan host frontend.
3. Pastikan URL berakhir dengan `?db=odoo_prod`.
4. Pastikan preflight `OPTIONS` bernilai 200.
5. Pastikan response memiliki `Access-Control-Allow-Origin` yang sesuai.
6. Pastikan POST berikutnya membawa cookie `session_id`.

## Build dan Deployment

```sh
npm run build
```

Perintah tersebut menjalankan type-check dan Vite production build. Hasil build
berada di `dist/`. Production SAKep disajikan oleh nginx dari:

```text
/var/www/sakep
```

Asset JS/CSS memakai nama ber-hash. Deploy asset baru terlebih dahulu dan
`index.html` terakhir agar pengguna tidak menerima index yang menunjuk asset
yang belum tersedia.
