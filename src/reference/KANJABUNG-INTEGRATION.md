# USPPS PT. KANJABUNG - Dokumentasi Integrasi

## Overview

USPPS PT. KANJABUNG adalah sistem laporan keuangan yang terintegrasi dengan aplikasi SAK EP reporting frontend. Laporan yang tersedia mencakup:

- Neraca Harian (Balance Sheet)
- Laba Rugi Harian (Profit and Loss)
- Neraca Percobaan (Trial Balance)

## Konfigurasi API

### URL & Endpoint

- **Base URL**: `http://36.92.125.247:33507`
- **Endpoint**: `/kirim/dashkan/get`
- **Method**: `POST`

### Headers

```json
{
  "Device-Terminal": "6cb9051e5b3156d9816ba58b3dd4ca49",
  "Signature": "6cb9051e5b3156d9816ba58b3dd4ca49",
  "Content-Type": "application/json"
}
```

### Environment Variables (.env.local)

```env
# USPPS (PT. KANJABUNG) API
VITE_KANJABUNG_API_BASE_URL=http://36.92.125.247:33507
VITE_KANJABUNG_DEVICE_TERMINAL=6cb9051e5b3156d9816ba58b3dd4ca49
VITE_KANJABUNG_SIGNATURE=6cb9051e5b3156d9816ba58b3dd4ca49
```

## Struktur Request

```json
{
  "request": "GetNeracaHarian",
  "userid": "System",
  "signature": "6cb9051e5b3156d9816ba58b3dd4ca49",
  "inptgljam": "20250313120530",
  "data01": {
    "unit": "00",
    "tgl": "20250313"
  }
}
```

### Request Types

- **GetNeracaHarian** - Neraca Harian (Balance Sheet)
- **GetLabaRugiHarian** - Laba Rugi Harian (Profit and Loss)
- **GetNeracaPercobaan** - Neraca Percobaan (Trial Balance)

### Parameter

- **unit**: Nomor unit/cabang (default: "00")
- **tgl**: Tanggal dalam format YYYYMMDD
- **inptgljam**: Timestamp dalam format YYYYMMDDHHmmss (dihasilkan otomatis)

### Catatan Response

- **GetNeracaHarian / GetNeracaPercobaan**: data detail umumnya ada di `dataNeraca`.
- **GetLabaRugiHarian**: data detail umumnya ada di `dataRugiLaba` (sebagian integrasi lama bisa memakai `dataLabaRugi`).

## Struktur File Aplikasi

### Services

- **File**: `src/services/kanjabungService.ts`
- **Fungsi**:
  - `fetchKanjabungBalanceSheet(params)` - Fetch neraca harian
  - `fetchKanjabungProfitLoss(params)` - Fetch laba rugi
  - `fetchKanjabungTrialBalance(params)` - Fetch neraca percobaan

### Types

- **File**: `src/types/kanjabungReport.ts`
- **Interface**:
  - `KanjabungReportRequestParams` - Parameter request
  - `KanjabungReportResult` - Hasil response
  - `KanjabungApiResponse` - Format API response
  - `KanjabungResponseHeader` - Header response
  - `KanjabungRequestBody` - Format body request

### Mock Data

- **File**: `src/data/mockKanjabungReports.ts`
- **Data**:
  - `mockKanjabungBalanceSheet` - Sample neraca harian
  - `mockKanjabungProfitLoss` - Sample laba rugi
  - `mockKanjabungTrialBalance` - Sample neraca percobaan

### Views/Components

- `src/views/ptKanjabung/PtKanjabungBalanceSheetView.vue`
- `src/views/ptKanjabung/PtKanjabungPnlView.vue`
- `src/views/ptKanjabung/PtKanjabungTrialBalanceView.vue`

## Routes

```typescript
{
  path: '/reports/pt-kanjabung/balance-sheet',
  name: 'pt-kanjabung-balance-sheet',
  component: PtKanjabungBalanceSheetView,
},
{
  path: '/reports/pt-kanjabung/pnl',
  name: 'pt-kanjabung-pnl',
  component: PtKanjabungPnlView,
},
{
  path: '/reports/pt-kanjabung/trial-balance',
  name: 'pt-kanjabung-trial-balance',
  component: PtKanjabungTrialBalanceView,
},
```

## Fitur

### Tanpa Drill-Down GL

Berbeda dengan PT. BPRS yang memiliki fitur drill-down ke General Ledger, KANJABUNG tidak menyediakan fitur ini. Semua laporan hanya menampilkan data agregat tanpa kemampuan melihat transaksi detail.

### Caching & Fallback

- Data terakhir yang berhasil dimuat disimpan di localStorage
- Jika data tanggal yang diminta kosong, otomatis fallback ke tanggal terakhir yang tersedia
- Jika API gagal/timeout, menampilkan mock data

### Error Handling

- Timeout: **30 detik** untuk setiap request (dinaikkan dari 12 detik)
- **Retry otomatis 1x** saat timeout atau network error sebelum fallback
- Fallback ke mock data jika:
  - API tidak tersedia setelah retry
  - Kredensial belum diset
  - Response format tidak valid
  - Network error

### ⚠️ CORS / Timeout di Production — Solusi Permanen

Request langsung dari browser ke `api-uspps.kanjabung.com` bisa timeout karena CORS preflight tidak direspons dengan benar oleh server backend USPPS.

**Solusi yang direkomendasikan**: Tambahkan reverse proxy di nginx `sakep.kanjabung.com` agar request USPPS diteruskan lewat server yang sama, seperti BPRS dan JAB Mart:

```nginx
# Tambahkan ke konfigurasi nginx sakep.kanjabung.com
location /api/uspps-kanjabung/ {
    proxy_pass https://api-uspps.kanjabung.com/;
    proxy_set_header Host api-uspps.kanjabung.com;
    proxy_set_header Content-Type application/json;
    proxy_read_timeout 60s;
    proxy_connect_timeout 10s;

    # CORS agar browser tidak terblokir
    add_header Access-Control-Allow-Origin $http_origin always;
    add_header Access-Control-Allow-Methods "POST, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Device-Terminal, Signature" always;

    if ($request_method = OPTIONS) {
        return 204;
    }
}
```

Setelah nginx dikonfigurasi, update `.env.production`:

```env
# Sebelum (direct — rentan CORS/timeout):
VITE_USPPS_KANJABUNG_API_BASE_URL=https://api-uspps.kanjabung.com

# Sesudah (melalui proxy — sama dengan BPRS & JAB Mart):
VITE_USPPS_KANJABUNG_API_BASE_URL=https://sakep.kanjabung.com/api/uspps-kanjabung
```

## Diferensiasi dari PT. BPRS

| Aspek         | PT. BPRS                                  | KANJABUNG                                 |
| ------------- | ----------------------------------------- | ----------------------------------------- |
| API Base URL  | `/api/bprs` (dev)                         | `http://36.92.125.247:33507` (production) |
| Endpoint      | `/kirim/dashkan/get`                      | `/kirim/dashkan/get`                      |
| Auth Headers  | Device-Terminal                           | Device-Terminal, Signature                |
| Drill-Down GL | ✅ Ada                                    | ❌ Tidak Ada                              |
| Reports       | 4 (Balance Sheet, PnL, GL, Trial Balance) | 3 (Balance Sheet, PnL, Trial Balance)     |
| Request Body  | userid, signature, device                 | signature saja                            |
| Timeout       | 12s (report), 45s (GL)                    | **30s + 1x retry**                        |

## Testing

### Test URL (Development)

```bash
curl -X POST http://36.92.125.247:33507/kirim/dashkan/get \
  -H "Device-Terminal: 6cb9051e5b3156d9816ba58b3dd4ca49" \
  -H "Signature: 6cb9051e5b3156d9816ba58b3dd4ca49" \
  -H "Content-Type: application/json" \
  -d '{
    "request": "GetNeracaHarian",
    "signature": "6cb9051e5b3156d9816ba58b3dd4ca49",
    "inptgljam": "20250313120530",
    "data01": {
      "unit": "00",
      "tgl": "20250313"
    }
  }'
```

## Referensi Konfigurasi Master

Lihat [reporting-config.json](./reporting-config.json) untuk konfigurasi lengkap semua entitas laporan.
