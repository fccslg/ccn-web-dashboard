# Chrome Extension Audit Report

**Project:** CCN Business Management System  
**Date:** 2025-11-21  
**Phase:** 1 — Audit and Discovery

---

## 1. Existing Extension Overview

### 1.1 Manifest Details
- **Name:** SMS Portal Enhancer
- **Version:** 1.0.0
- **Manifest Version:** 3
- **Target Site:** `https://sms.ccnsiliguri.com/*` (Ezybill portal)

### 1.2 Architecture
The extension follows an MVC-inspired architecture with these core layers:
- **Controllers:** BackgroundController, ContentController, LoginController, DashboardController
- **Models:** LoginModel, ExtensionModel, ProjectModel
- **Views:** LoginView, DashboardView, PopupView
- **Services:** StorageService, ScraperService, DataAggregatorService, ProductsService, OcrService
- **Managers:** StateManager, StorageManager, InteractionManager, MoveableManager, SelectoManager
- **Engines:** DragEngine, ResizeEngine, SnapEngine, PrintEngine

### 1.3 Technology Stack
- **Build Tool:** Vite
- **Language:** ES Modules (JavaScript)
- **Dependencies:** tesseract.js (OCR), moment, luxon, moveable, selecto, sortablejs, tabulator-tables, qrcode
- **Permissions:** `storage`, host permissions for target site and dev URLs

---

## 2. Functional Audit

### 2.1 Working Features

| Feature | Status | Implementation Details |
|---------|--------|------------------------|
| **Login Page Detection** | ✅ Working | Detects login page via `#uname` selector |
| **Credential Storage** | ✅ Working | Uses `chrome.storage.local` via StorageService |
| **Auto-fill Credentials** | ✅ Working | Fills username/password on page load |
| **Captcha OCR Solving** | ✅ Working | Uses tesseract.js with digit whitelist (0-9) |
| **Auto-captcha Refresh** | ✅ Working | Forces captcha reload on page load via `#changeCaptcha` |
| **Login Form Interception** | ✅ Working | Captures credentials on submit, avoids MD5 hash |
| **Dashboard UI Upgrade** | ✅ Working | Injects custom styling, wallet pill, quick search |
| **Dashboard Stats Scraping** | ✅ Working | Scrapes wallet balance, active/deactive counts |
| **Portal Data Scraping** | ✅ Working | Exports Customers, STBs, Products, Bundles, Service Extensions, Ledger |
| **Data Aggregation** | ✅ Working | Merges Customers + STBs + Extensions into unified DB |
| **Settings Persistence** | ✅ Working | Saves feature toggles, theme, wallet thresholds |
| **Backup/Restore** | ✅ Working | Export/import settings to JSON file |
| **Popup UI** | ✅ Working | 5-tab settings panel (General, Login, Dashboard, Scraper, Backup) |

### 2.2 Incomplete / Partial Features

| Feature | Status | Gaps |
|---------|--------|------|
| **Customer Search/Filtering** | Partial | Quick search exists but no deep customer lookup |
| **Collection Entry** | ❌ Missing | No bookkeeping integration in extension |
| **Cashbook/Expense Entry** | ❌ Missing | Not implemented |
| **Offline Support** | ❌ Missing | No IndexedDB, no sync queue |
| **Multi-user/Employee Support** | ❌ Missing | Single-user credential storage only |
| **Sync to Cloud Database** | ❌ Missing | Local storage only |
| **Android App** | ❌ Missing | Not started |

### 2.3 Extension-Portal Interaction

The extension interacts with the Ezybill portal (`sms.ccnsiliguri.com`) via:
1. **DOM Manipulation** - Injects overlay on login page, modifies dashboard UI
2. **AJAX API Calls** - Uses internal Ezybill endpoints:
   - `/index.php/Customeroperations/getCustomerData//`
   - `/index.php/Dasreports/dasStbLocationsnewtheme_listrealtime//`
   - `/index.php/Products/productlistgrid//`
   - `/index.php/Bundle/bundle_list_grid_newtheme//`
   - `/index.php/Customer/getServiceExtendableList//`
   - `/index.php/Employee/lco_deposit_ledger_newtheme_list//`
3. **Credential Capture** - Intercepts form submit to save raw password (before MD5 hashing)
4. **Captcha Handling** - OCR on `#imgCaptcha img`, auto-refresh via `#changeCaptcha`

**Critical Dependency:** The extension relies on undocumented internal AJAX endpoints that could change without notice. No official API exists.

---

## 3. Data Stored Locally

### 3.1 Chrome Storage (`chrome.storage.local`)
- `extension_settings` - Feature toggles, theme, wallet thresholds
- `cached_portal_stats` - Wallet balance, active/deactive counts
- `aggregated_portal_db` - Full merged customer/STB/extension database (JSON)
- `selected_active_range` - Dashboard filter state
- Login credentials (username/password pairs)

### 3.2 LocalStorage (Portal Page)
- Various UI preferences: `ledger_group_mode`, `ledger_whatsapp_template_*`, `renewals_visible_columns`, etc.
- Table layout persistence: `ccn_ledger_table_persistence_v3`

---

## 4. Reusable Components

| Component | Reusability for Bookkeeping |
|-----------|----------------------------|
| StorageService | ✅ High - Abstract storage layer |
| LoginModel/LoginView | ⚠️ Low - Portal-specific |
| DashboardController/DashboardView | ⚠️ Medium - Could adapt for bookkeeping dashboard |
| DataAggregatorService | ✅ High - Data merge patterns applicable |
| ScraperService | ⚠️ Low - Portal-specific endpoints |
| OcrService | ⚠️ Low - Captcha-specific |
| StateManager | ✅ High - Generic state management |
| Popup UI Components | ✅ High - Settings panels, forms, lists |

---

## 5. Development-Only Permissions to Remove

The manifest includes these unnecessary host permissions for production:
```
"*://*.example.com/*"
"*://*.example.org/*"
"http://127.0.0.1/*"
"http://localhost/*"
```

**Recommendation:** Remove these from production build; keep only `https://sms.ccnsiliguri.com/*`.

---

## 6. Source Code Availability

The `AI/src/` directory contains **original source code** (not just bundled output):
- Well-organized modular structure
- ES Modules with proper imports
- Source maps not present but source is readable
- Build script (`build.js`) produces `dist/` with bundled files

**Verdict:** Original source IS available. No reverse-engineering needed.