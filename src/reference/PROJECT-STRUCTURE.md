# SAK EP Reporting - Project Structure & Configuration

## Quick Reference

### Available Reporting Entities

1. **PT. JAB Mart** (`pt-jar`)
   - Routes: `/reports/pt-jar/*`
   - Reports: Balance Sheet, PnL, Ledger, Trial Balance
   - Service: `jabMartService.ts`

2. **PT. BPRS** (`pt-bprs`)
   - Routes: `/reports/pt-bprs/*`
   - Reports: Balance Sheet, PnL, GL, Trial Balance
   - Service: `bprsService.ts`

3. **USPPS PT. KANJABUNG** (`pt-kanjabung`) ⭐ NEW
   - Routes: `/reports/pt-kanjabung/*`
   - Reports: Balance Sheet, PnL, Trial Balance
   - Service: `kanjabungService.ts`

## Directory Structure

```
src/
├── services/
│   ├── jabMartService.ts
│   ├── bprsService.ts
│   ├── kanjabungService.ts          # NEW: KANJABUNG service
│   └── ...
│
├── types/
│   ├── report.ts
│   ├── bprsReport.ts
│   ├── kanjabungReport.ts           # NEW: KANJABUNG types
│   └── ...
│
├── data/
│   ├── mockJarReports.ts
│   ├── mockBprsReports.ts
│   ├── mockKanjabungReports.ts      # NEW: KANJABUNG mock data
│   └── ...
│
├── views/
│   ├── ptJar/
│   ├── ptBprs/
│   ├── ptKanjabung/                 # NEW: KANJABUNG views
│   │   ├── PtKanjabungBalanceSheetView.vue
│   │   ├── PtKanjabungPnlView.vue
│   │   └── PtKanjabungTrialBalanceView.vue
│   └── ...
│
├── reference/
│   ├── reporting-config.json        # NEW: Master configuration
│   ├── KANJABUNG-INTEGRATION.md     # NEW: KANJABUNG documentation
│   └── ...
│
├── router/
│   └── index.ts                     # UPDATED: Added KANJABUNG routes
│
└── ...

.env.local                           # UPDATED: Added KANJABUNG config
.env.example                         # UPDATED: Added KANJABUNG template
```

## Environment Configuration

### .env.local (Development)

```env
# KANJABUNG Configuration
VITE_KANJABUNG_API_BASE_URL=http://36.92.125.247:33507
VITE_KANJABUNG_DEVICE_TERMINAL=6cb9051e5b3156d9816ba58b3dd4ca49
VITE_KANJABUNG_SIGNATURE=6cb9051e5b3156d9816ba58b3dd4ca49

# BPRS Configuration
VITE_BPRS_API_BASE_URL=/api/bprs
VITE_BPRS_USER=System
VITE_BPRS_SIGNATURE=0842737f429ca9f1694a73ace4d49e5e
VITE_BPRS_DEVICE=Denmas

# JAB Mart Configuration
VITE_JABMART_API_BASE_URL=/api/jabmart
VITE_JABMART_USER=kanjabung
VITE_JABMART_PASSWORD=W4oAB4jH3pPoTb6J
```

### .env.example (Template)

```env
# USPPS (PT. KANJABUNG) API
VITE_KANJABUNG_API_BASE_URL=http://36.92.125.247:33507
VITE_KANJABUNG_DEVICE_TERMINAL=6cb9051e5b3156d9816ba58b3dd4ca49
VITE_KANJABUNG_SIGNATURE=6cb9051e5b3156d9816ba58b3dd4ca49

# ... (other configurations)
```

## API Integration Pattern

All reporting services follow a consistent pattern:

### 1. Service Layer (`src/services/*.ts`)

- Handles API calls and error management
- Implements request/response transformation
- Provides fallback to mock data

### 2. Type Definitions (`src/types/*.ts`)

- Defines request parameters
- Defines response structure
- Ensures type safety

### 3. Mock Data (`src/data/*.ts`)

- Sample data for development/testing
- Used as fallback when API fails
- Matches production response format

### 4. Views (`src/views/pt*/`)

- Vue components for each report
- Handles user input and filtering
- Manages loading states and error display

### 5. Routes (`src/router/index.ts`)

- Defines URL paths and component mapping
- Named routes for programmatic navigation

## Common Tasks

### Adding a New Report Type

1. **Add to Service** (`src/services/kanjabungService.ts`)

   ```typescript
   export const fetchKanjabung<NewReport> = (params) =>
     fetchKanjabungReport('RequestType', params, mockData)
   ```

2. **Create View** (`src/views/ptKanjabung/PtKanjabung<NewReport>View.vue`)

   ```vue
   <script setup>
   import { fetchKanjabung<NewReport> } from '@/services/kanjabungService'
   // ... component logic
   </script>
   ```

3. **Add Route** (`src/router/index.ts`)

   ```typescript
   {
     path: '/reports/pt-kanjabung/new-report',
     name: 'pt-kanjabung-new-report',
     component: PtKanjabung<NewReport>View,
   }
   ```

4. **Add Mock Data** (`src/data/mockKanjabungReports.ts`)
   ```typescript
   export const mockKanjabung<NewReport> = [...]
   ```

### Updating API Credentials

1. Update `.env.local`:

   ```env
   VITE_KANJABUNG_SIGNATURE=new_signature_value
   VITE_KANJABUNG_DEVICE_TERMINAL=new_terminal_id
   ```

2. Restart development server
3. Credentials will be picked up automatically

### Testing API Connection

1. Check `.env.local` has all required variables
2. Open browser DevTools → Network tab
3. Navigate to `/reports/pt-kanjabung/balance-sheet`
4. Observe network request to API endpoint
5. Verify response has correct structure

## Error Messages & Troubleshooting

### "Konfigurasi API KANJABUNG production belum benar"

- **Cause**: Using relative API URL in production
- **Solution**: Set `VITE_KANJABUNG_API_BASE_URL` to absolute URL in production

### "VITE_KANJABUNG_SIGNATURE dan/atau VITE_KANJABUNG_DEVICE_TERMINAL belum diset"

- **Cause**: Missing credentials in `.env.local`
- **Solution**: Add credentials to `.env.local` and restart dev server

### "Request timeout setelah 12 detik"

- **Cause**: API endpoint slow or unreachable
- **Solution**:
  - Check network connectivity
  - Verify API endpoint is working
  - Consider increasing timeout value

### "Format respons API tidak valid"

- **Cause**: API response structure doesn't match expected format
- **Solution**:
  - Verify API request parameters
  - Check API documentation for response format
  - Update response parsing logic if API changed

## Reference Files

- 📄 [Reporting Configuration (JSON)](./src/reference/reporting-config.json)
- 📄 [KANJABUNG Integration Guide](./src/reference/KANJABUNG-INTEGRATION.md)
- 📄 [Sample Postman Collection](./src/reference/KanBPRS.postman_collection.json)

## Version History

### Current Release

- ✅ PT. JAB Mart integration
- ✅ PT. BPRS integration with GL drill-down
- ✅ USPPS PT. KANJABUNG integration (NEW)
- ✅ Trial Balance reports for all entities
- ✅ Excel export functionality
- ✅ Mock data fallback system
- ✅ Responsive UI design
