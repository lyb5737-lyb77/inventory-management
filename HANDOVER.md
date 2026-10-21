# BIT 관리 시스템 — 인수인계 문서

> 사내 통합 자산/재고/주문/임대 관리 웹 애플리케이션
> 최종 정리일: 2026-10-21

관련 문서는 다음과 같습니다.
- [README.md](README.md) — 실행 및 배포 요약
- [AUTH_GUIDE.md](AUTH_GUIDE.md) — Microsoft 로그인 방식을 다른 프로젝트에 이식하는 가이드

---

## 1. 한눈에 보기

| 항목 | 내용 |
|------|------|
| **프로젝트명** | BIT 관리 시스템 (inventory-management) |
| **유형** | SPA (Single Page Application), 서버 없는 정적 웹앱 |
| **프런트엔드** | React 18 + TypeScript + Vite + Tailwind CSS |
| **인증** | Microsoft Entra ID (Azure AD) — MSAL |
| **데이터 저장소** | **백엔드 서버 없음.** Microsoft 365 SharePoint 리스트를 DB처럼 사용 (Microsoft Graph API) |
| **배포** | GitHub Pages (GitHub Actions 자동 배포) |
| **운영 URL** | https://lyb5737-lyb77.github.io/inventory-management/ |
| **저장소** | https://github.com/lyb5737-lyb77/inventory-management |
| **로그인 제한** | `bit.kr` 계정(Microsoft)만 사용 가능 |

> ⚠️ **핵심 개념**: 이 앱은 자체 DB/백엔드가 없습니다. 모든 데이터는 회사 SharePoint(`bitkr.sharepoint.com/sites/bit.kr`)의 리스트에 저장되며, 브라우저에서 로그인한 사용자의 권한으로 Graph API를 직접 호출해 읽고 씁니다. 따라서 **SharePoint 리스트와 컬럼 구조가 곧 데이터베이스 스키마**입니다.

---

## 2. 기술 스택 & 주요 의존성

| 패키지 | 용도 |
|--------|------|
| `react`, `react-dom` `^18` | UI 프레임워크 |
| `react-router-dom` `^6` | 라우팅 (HashRouter 사용 — GitHub Pages 새로고침 대응) |
| `@azure/msal-browser`, `@azure/msal-react` | Microsoft 로그인/토큰 |
| `@microsoft/microsoft-graph-client` | SharePoint 데이터 CRUD |
| `xlsx` (SheetJS) | 엑셀 읽기(업로드 파싱) 및 단순 다운로드 |
| `exceljs` | **서식(폰트/색/열너비)을 유지한** 엑셀 다운로드. 주문 월 다운로드에 사용 |
| `qrcode.react` | 장비 QR 코드 생성 |
| `@emailjs/browser` | 출고 신청 이메일 발송 |
| `date-fns` | 날짜 포맷 |
| `tailwindcss` | 스타일링 |
| 아이콘 | Remixicon (CDN, `index.html`에서 로드) |

---

## 3. 실행 / 빌드 / 배포

```bash
# 의존성 설치
npm install

# 로컬 개발 서버 (Vite) — http://localhost:5173/inventory-management/
npm run dev

# 프로덕션 빌드 (tsc 타입체크 후 vite build, 메모리 8GB 할당)
npm run build
```

### 배포 (⚠️ 가장 중요)

배포는 **`main` 브랜치에 push** 하면 GitHub Actions(`.github/workflows/deploy.yml`)가 자동으로 빌드 후 GitHub Pages에 반영합니다. 보통 1~2분 걸립니다.

```bash
git add <수정한 파일>
git commit -m "수정 내용"
git push origin main
```

- 로컬에서 `npm run deploy`(`gh-pages`)를 돌려도 GitHub Actions가 우선 동작하므로 **반드시 push로 배포**하는 것을 권장합니다. 수동 배포는 원격에 불필요한 `gh-pages` 브랜치만 만듭니다.
- `vite.config.ts`의 `base: '/inventory-management/'` 설정 때문에 GitHub Pages 경로가 고정되어 있습니다. 저장소 이름을 바꾸면 이 값과 `authConfig.ts`의 `redirectUri`도 같이 바꿔야 합니다.
- **로컬 `npm run build`는 PC 사양에 따라 메모리 부족으로 중간에 종료될 수 있습니다.** 이 경우에도 `tsc --noEmit`이 통과하면 코드는 정상이며, 실제 빌드는 GitHub Actions에서 수행되므로 push 후 Actions 결과를 확인하면 됩니다.
- **push 시 403 오류**가 나면 Windows에 저장된 GitHub 로그인이 다른 계정으로 되어 있는 경우입니다. 해당 저장소 권한이 있는 계정(`lyb5737-lyb77`)으로 다시 로그인해야 합니다.

---

## 4. 인증 & 권한 시스템

로그인 방식 자체의 상세 설명과 다른 프로젝트 이식 방법은 [AUTH_GUIDE.md](AUTH_GUIDE.md)를 참고하세요.

### 4.1 로그인 (MSAL / Azure AD)
- 설정 위치: [src/authConfig.ts](src/authConfig.ts)
- `clientId`, `authority`(테넌트)가 하드코딩되어 있음.
- 요청 권한(scope): `User.Read`, `Sites.ReadWrite.All`, `Mail.Send`, `Files.ReadWrite.All`
- `redirectUri`는 github.io 도메인이면 운영 URL, 아니면 `window.location.origin`(로컬)으로 자동 분기.
- 토큰은 `sessionStorage`에 캐싱 (브라우저 탭을 닫으면 만료).

### 4.2 권한(메뉴 접근) 시스템
- 핵심 로직: [src/auth/AuthContext.tsx](src/auth/AuthContext.tsx), [src/auth/permissionService.ts](src/auth/permissionService.ts)
- 권한 데이터는 SharePoint `UserPermissions` 리스트에 저장.
- 역할(Role)은 **ADMIN** / **USER** 두 가지.
  - `ADMIN`: 모든 메뉴 접근 가능.
  - `USER`: `AllowedMenus`(CSV)에 명시된 메뉴만 접근 가능.
- **부트스트랩 관리자**(시스템 락아웃 방지용): [src/auth/constants.ts](src/auth/constants.ts)의 `BOOTSTRAP_ADMINS` 배열에 등록된 이메일은 SharePoint 권한 레코드와 무관하게 **항상 ADMIN**.
  - 현재: `lyb77@bit.kr`, `show@bit.kr`
  - ⚠️ 이 두 계정은 권한 시스템이 깨져도 항상 들어올 수 있는 안전장치이므로 함부로 지우지 말 것.
- 권한 정보는 `sessionStorage`에 **5분(TTL)** 캐싱됨 (`PERMISSION_CACHE_TTL_MS`). 권한 변경 직후 반영이 안 되면 새로고침/재로그인 또는 관리자 패널의 새로고침 사용.

### 4.3 권한 관리 UI
- [src/components/PermissionAdminPanel.tsx](src/components/PermissionAdminPanel.tsx) — 관리자 페이지의 "권한 관리" 탭.
- 사용자 추가/수정/삭제, 역할 지정, 접근 메뉴(체크박스) 지정, 활성화 여부(`IsActive`) 관리.

> ⚠️ **알아둘 보안 한계**: 메뉴 접근 제어는 **홈 화면에서 카드(메뉴)를 숨기는 UI 레벨** 입니다([src/pages/HomePage.tsx](src/pages/HomePage.tsx)). 각 페이지 컴포넌트(`/inventory` 등)에는 라우트 가드가 없어, URL을 직접 입력하면 접근 가능합니다. 진짜 보안 경계는 SharePoint 리스트 자체의 권한입니다. 민감 데이터 접근 통제가 필요하면 SharePoint 측 권한으로 막아야 합니다.

---

## 5. 화면(메뉴) 구성

메뉴 정의는 [src/constants/menus.ts](src/constants/menus.ts)에 중앙 관리됩니다. 라우트는 [src/App.tsx](src/App.tsx)에 정의.

| 메뉴 키 | 경로 | 화면 파일 | 설명 |
|---------|------|-----------|------|
| (홈) | `/` | [HomePage.tsx](src/pages/HomePage.tsx) | 접근 가능한 메뉴 카드 표시 + 임대 계약 만료 임박 알림 |
| `admin` | `/admin` | [AdminPage.tsx](src/pages/AdminPage.tsx) | 품목/제품그룹/창고/출고처/**권한**/**메일 설정** 관리 (탭 구성) |
| `inventory` | `/inventory` | [InventoryPage.tsx](src/pages/InventoryPage.tsx) | 입·출고 처리, 재고 현황, 입출고 조회, 엑셀 다운로드, 인쇄 |
| `order-register` | `/order-register` | [OrderRegisterPage.tsx](src/pages/OrderRegisterPage.tsx) | 비트몰 주문 등록(엑셀 업로드/개별 입력), 출고 처리, 품번 수정, 월 다운로드 |
| `outbound-request` | `/outbound-request` | [OutboundRequestPage.tsx](src/pages/OutboundRequestPage.tsx) | 창고 담당자에게 출고 요청 이메일 발송 + 거래 기록 |
| `rental` | `/rental` | [RentalPage.tsx](src/pages/RentalPage.tsx) | 임대 현황/계약 관리, 엑셀 업로드/다운로드 |
| `ip-management` | `/ip-management` | [IpManagementPage.tsx](src/pages/IpManagementPage.tsx) | IP 대역(게이트웨이/서브넷마스크 포함) 및 IP별 사용 현황 관리 |
| `equipment` | `/equipment` | [EquipmentPage.tsx](src/pages/EquipmentPage.tsx) | 업무용 장비 관리, 변경 이력, QR 코드 |
| (장비조회) | `/equipment/viewer/:id` | [EquipmentViewerPage.tsx](src/pages/EquipmentViewerPage.tsx) | QR 스캔 시 보이는 장비 상세 (읽기 전용) |
| (로그인) | — | [LoginPage.tsx](src/pages/LoginPage.tsx) | 비로그인 시 표시 |

> 메뉴를 추가/변경하려면 ① `menus.ts`에 메뉴 정의 추가 → ② `App.tsx`에 라우트 추가 → ③ `MenuKey` 타입에 키 추가, 세 곳을 함께 수정해야 합니다.

---

## 6. 데이터 계층 (SharePoint 연동)

### 6.1 구조
```
UI 페이지
  └─ src/storage.ts          ← 도메인별 CRUD 함수 (앱 타입 ↔ SharePoint 필드 매핑)
       └─ src/services/sharepoint.ts   ← 범용 리스트 CRUD (getListItems / create / update / delete)
            └─ src/services/graph.ts   ← Graph 클라이언트 + 토큰 획득
```

- [src/storage.ts](src/storage.ts): 가장 중요한 파일. 앱의 TypeScript 모델(`Item`, `Order` 등)과 SharePoint 컬럼(`Title`, `Quantity` 등) 간 매핑을 모두 담당.
- [src/services/sharepoint.ts](src/services/sharepoint.ts): 사이트 ID 캐싱, 페이지네이션(`@odata.nextLink`), 5000건 단위 조회, 에러 메시지 처리.
- 타입 정의: [src/types.ts](src/types.ts)

### 6.2 SharePoint 리스트 목록
설정: [src/authConfig.ts](src/authConfig.ts)의 `sharePointConfig.listNames`

| 앱 내 이름 | SharePoint 리스트명 | 용도 |
|-----------|--------------------|------|
| items | `InventoryItems` | 재고 품목 |
| productGroups | `ProductGroups` | 제품 그룹 |
| transactions | `Transactions` | 입·출고 거래 내역 |
| rentals | `RentalContracts` | 임대 계약 |
| warehouses | `Warehouses` | 창고 |
| customers | `Customers` | 출고처(거래처) |
| ipRanges | `IpRanges` | IP 대역 (`Gateway`, `SubnetMask` 컬럼 포함) |
| ipDetails | `IpDetails` | IP별 상세(사용자/부서/용도) |
| equipments | `Equipments` | 업무용 장비 |
| equipmentLogs | `EquipmentLogs` | 장비 변경 이력 |
| userPermissions | `UserPermissions` | 사용자 권한 |
| orders | `Orders` | 비트몰 주문 내역 |
| appSettings | `AppSettings` | 앱 설정(현재는 메일 발송 설정을 JSON으로 저장) |

**리스트별 컬럼 메모**
- `Orders` — Title(품번), OrderDate, CustomerCode, CustomerName, BizNumber, PartNumber, ProductName, Quantity, SalesUnitPrice, PaymentType, Email, Contact, Address, Status(미처리/출고완료), ShippedWarehouse, UploadBatch, Remarks
- `AppSettings` — Title(설정 키, 현재 `emailjs`), Value(**여러 줄 텍스트**, JSON 문자열)
- `Customers` — 기존 컬럼에 더해 `OfficeNumber`(사업자번호), `CEO`(대표명), `MobilePhone`(핸드폰)을 사용. 사업자번호는 **숫자만** 저장·비교함.

### 6.3 ⚠️ SharePoint 사용 시 주의사항
- **수량/가격은 SharePoint에서 텍스트(문자열) 타입**으로 저장됨. 앱에서 `String()`/`parseInt()`로 변환 처리. (`storage.ts` 참고)
- 컬럼 내부명(internal name)은 표시명과 다를 수 있음. `Title`은 항상 첫 번째 기본 컬럼이며 도메인마다 다른 의미로 재활용됨.
  - Items → 품명, Rentals → 임대인명, Orders → 품번, EquipmentLogs → **장비 ID**, UserPermissions → **이메일**.
- 데이터 추가 시 400 에러가 나면 십중팔구 **리스트 컬럼명/타입 불일치**. (sharepoint.ts에 친절한 에러 메시지 있음)
- 새 필드를 추가하려면 ① SharePoint 리스트에 컬럼 생성 → ② `storage.ts`의 매핑 함수(get/add/update) 수정 → ③ `types.ts` 인터페이스 수정.
- 리스트가 없거나 컬럼이 없으면 조회 함수는 오류 대신 **빈 목록**을 돌려주는 경우가 많아, 화면에는 "데이터 없음"으로만 보일 수 있음.

### 6.4 날짜 처리 규칙 (⚠️ KST)
- 거래/주문 날짜는 문자열(`YYYY-MM-DD`)로 저장하며, **오늘 날짜는 반드시 [src/utils/date.ts](src/utils/date.ts)의 `todayKst()`** 를 사용합니다.
- `new Date().toISOString()`은 UTC 기준이라 한국시간 0~9시에 하루 전 날짜가 나옵니다. 입출고 조회에서 누락되는 원인이었으므로 날짜 기본값에는 쓰지 않습니다.
- 장비 구입일 기본값(`EquipmentPage.tsx`)에는 아직 `toISOString()` 패턴이 남아 있습니다.

---

## 7. 도메인별 핵심 동작

### 재고/거래 (Inventory)
- 입고(IN)/출고(OUT) 거래를 `Transactions`에 기록하면서, 동시에 해당 품목의 `Quantity`(현재고)를 가감 업데이트 (`addTransaction` in `storage.ts`).
- 마이너스 재고 허용 (출고 시 재고보다 많아도 차감됨 — 음수 가능).
- 입출고 조회 결과는 날짜 내림차순이며, 같은 날짜는 나중에 입력된 건(id가 큰 건)이 위로 정렬됨.
- 엑셀 다운로드 기능 제공.

### 주문 등록 (Order Register) — 비트몰
주문은 두 가지 방식으로 등록합니다. 엑셀은 `비트몰 자재출고 YYYY.MM.DD.xlsx` 양식이며 출고일자=주문일자, 거래처코드=더존번호입니다.

**엑셀 업로드 검증 순서** ([OrderRegisterPage.tsx](src/pages/OrderRegisterPage.tsx) `handleRegisterParsed`)
1. 미등록 품번이 하나라도 있으면 **전체 중단** (오타 또는 제품 등록 필요 안내)
2. 최근 업로드 10개 배치의 품번↔품명과 다르면 **전체 중단** (품번-품명 불일치)
3. 거래처코드가 없으면 **사업자번호로 기존 출고처를 찾아** 코드를 채우고, 코드만 있고 사업자번호가 없으면 기존 출고처에서 보완
4. 그래도 코드가 없는 행은 **거래처코드 입력 모달**로 받아 신규 출고처로 등록 (비우거나 취소하면 전체 중단)
5. 신규 출고처 등록 시 **거래처코드와 사업자번호는 각각 고유**여야 하며, 중복이면 중단

**출고 처리**
- 같은 품번이 본사(`비트본사`)와 다른 창고에 모두 있으면 `본사출고`/`창고출고` 버튼이 따로 표시됨.
- `본사출고` — 안내 팝업(거래처·연락처·주소·품명·품번·금일날짜, "창고 출고바랍니다.")을 띄우고 확인하면 재고 차감 + 출고완료. 이메일은 보내지 않음.
- `창고출고` — 비고 입력 후 창고 담당자에게 이메일 발송 + 재고 차감 + 출고완료.

**품번 수정** — 주문 행의 연필 버튼. 미처리 건은 품번/품명만 정정하고, **출고완료 건은 잘못 나간 품목을 입고로 복원하고 올바른 품목을 같은 창고에서 재출고**하여 재고까지 보정함. 정정할 품번이 해당 창고에 없으면 중단.

**월 다운로드** — 해당 월 주문을 27열 ERP 양식(`public/order-template.xlsx`)으로 내려받음. 서식은 양식 파일을 그대로 불러와 데이터만 채우는 방식이라 폰트·색·열너비가 유지됨.
- 고정값: 창고코드 `1000`, 장소코드 `1100`, 거래구분/과세구분/단가구분 `0`, 환종 `KRW`, 환율 `1`, 프로젝트코드 `3100`
- 재고수량 = 출고수량, 매입단가 = 품목(Item) 가격(품번 매칭), 매입금액 = 출고수량×매입단가, 마진 = 매출금액−매입금액
- 양식의 단가표 시트와 샘플 고객정보는 제거한 상태로 동봉됨.

> ⚠️ **주문 삭제는 재고를 되돌리지 않습니다.** 출고완료된 주문을 삭제해도 차감된 재고와 OUT 거래 기록은 그대로 남습니다. 재고를 복원하려면 자재 관리에서 입고를 수동 등록해야 합니다.

### 출고 신청 (Outbound Request)
- 창고 담당자 이메일로 출고 요청 메일 발송 + OUT 거래 기록(재고 차감). 발송 엔진은 **EmailJS** ([src/services/email.ts](src/services/email.ts)).

### 메일 설정 (관리자 → 메일 설정 탭)
- EmailJS의 Service ID / Template ID / Public Key, 발신자 표시명, CC, 발송 사용 여부를 관리하고 **테스트 발송**이 가능함. ([MailSettingsPanel.tsx](src/components/MailSettingsPanel.tsx), [settings.ts](src/services/settings.ts))
- 설정은 `AppSettings` 리스트에 저장되며, 리스트가 없거나 비어 있으면 `settings.ts`의 기본값(기존 하드코딩 값)으로 동작함.
- 이 앱은 브라우저 전용이라 **SMTP로 직접 발송할 수 없어** EmailJS를 사용함.
- EmailJS 서비스가 Gmail API 방식이면 `Invalid grant. Please reconnect your Gmail account` 오류가 날 수 있음. 이는 코드 문제가 아니라 Gmail 인증 만료이므로 **EmailJS 대시보드 → Email Services에서 해당 서비스를 재연결**하면 됨.

### 출고처 (관리자 → 출고처 탭)
- 필드는 더존번호, 출고처명, 사업자번호, 대표명, 연락처, 핸드폰, 이메일, 주소, 비고임.
- 사업자번호는 하이픈 등 숫자 외 문자를 제거하고 저장·비교함 (`424-94-00087` = `4249400087`).

### 임대 관리 (Rental)
- 호실별 면적 매핑은 [src/constants/roomData.ts](src/constants/roomData.ts)에 고정값으로 정의 (101~402호).
- 엑셀 업로드/다운로드 지원 ([src/services/excelService.ts](src/services/excelService.ts)). 업로드 시 회사 양식(제목 1행, 헤더 1행)에 맞춰 3번째 행부터 파싱하며, 컬럼명 변형(공백 포함 등)에 폭넓게 대응.
- 홈 화면에서 계약 종료 3개월 이내 건을 alert로 알림.
  - ⚠️ **주의/버그 소지**: 이 만료 알림은 `localStorage`의 `rental_data`를 읽음(HomePage.tsx) — SharePoint 데이터가 아님. 또한 존재하지 않는 `dong` 필드를 참조함. 실제로는 동작하지 않을 가능성이 높으니 점검 필요.

### IP 자산 관리 (IP Management)
- IP 대역(`IpRanges`)을 등록하면 시작~종료 IP 사이를 자동 펼쳐(`generateIpListInRange`) 각 IP의 사용 현황(`IpDetails`)을 관리.
- 대역마다 **게이트웨이/서브넷마스크**를 입력·수정할 수 있고(선택한 대역의 연필 버튼), IP 상세 정보에 표시됨.
- IP 상세 정보의 **복사 버튼**은 IP·게이트웨이·서브넷마스크를 한 번에 클립보드로 복사함.
- 빠른 검색은 IP·사용자·부서·**용도**를 대상으로 함.
- 엑셀로 IP 사용 현황 일괄 업로드 가능. (엑셀 다운로드 기능은 없음)
- 실제 네트워크 사용 여부(핑/ARP)는 브라우저에서 확인할 수 없음. 별도 스캐너로 확인한 결과를 엑셀로 업로드하는 방식이 현실적임.

### 장비 관리 (Equipment)
- 장비 등록/수정/삭제 + 변경 이력(`EquipmentLogs`) 기록.
- **관리번호 자동 채번**: `BIT` + `YYMM`(구입일 기준) + 3자리 순번 형식 (예: `BIT2506001`). 동일 접두사 내 최대 순번 +1 (`handleGenerateManagementNumber`).
- 관리번호 중복 검사 있음.
- **QR 코드**: 각 장비마다 `#/equipment/viewer/:id` 링크를 QR로 생성. 스캔 시 읽기 전용 상세 페이지로 이동 (모바일에서 자산 확인용).
- 엑셀 일괄 등록/다운로드 지원.

---

## 8. 프로젝트 구조

```
BIT_management/
├─ .github/workflows/deploy.yml   # GitHub Pages 자동 배포
├─ index.html                     # 진입 HTML (Remixicon CDN)
├─ vite.config.ts                 # base 경로, 청크 분리, 빌드 설정
├─ tailwind.config.js
├─ package.json
├─ public/
│  └─ order-template.xlsx         # 주문 월 다운로드용 27열 양식 (서식 보존용)
├─ src/
│  ├─ main.tsx                    # MSAL 초기화 후 앱 렌더
│  ├─ App.tsx                     # 라우팅 + 인증 게이트(MsalProvider)
│  ├─ authConfig.ts               # MSAL + SharePoint 설정 (★ 환경 상수)
│  ├─ types.ts                    # 전체 도메인 타입
│  ├─ storage.ts                  # ★ SharePoint CRUD + 필드 매핑
│  ├─ auth/
│  │  ├─ AuthContext.tsx          # 권한 컨텍스트 (캐시/부트스트랩)
│  │  ├─ permissionService.ts     # UserPermissions 리스트 CRUD
│  │  ├─ usePermission.ts         # canAccess 훅
│  │  └─ constants.ts             # 부트스트랩 관리자, 캐시 TTL
│  ├─ services/
│  │  ├─ graph.ts                 # Graph 클라이언트
│  │  ├─ sharepoint.ts            # 범용 리스트 CRUD
│  │  ├─ email.ts                 # EmailJS 출고 메일 / 테스트 발송
│  │  ├─ settings.ts              # AppSettings 리스트 기반 메일 설정
│  │  └─ excelService.ts          # 엑셀 입출력 (주문 파싱/월 다운로드 등)
│  ├─ utils/
│  │  └─ date.ts                  # todayKst() — KST 기준 날짜
│  ├─ constants/
│  │  ├─ menus.ts                 # 메뉴/라우트 정의
│  │  └─ roomData.ts              # 호실 면적표
│  ├─ components/
│  │  ├─ Layout.tsx               # 공통 헤더/로그아웃
│  │  ├─ PermissionAdminPanel.tsx # 권한 관리 UI
│  │  └─ MailSettingsPanel.tsx    # 메일 설정 UI
│  └─ pages/                      # 각 화면
└─ (루트의 .xlsx/.cjs/.docx 등은 초기 데이터 마이그레이션용 보조 파일)
```

> 루트에 있는 `비트몰 자재출고*.xlsx`, `거래처목록*.xlsx`는 실제 고객 정보가 들어 있어 `.gitignore`로 커밋에서 제외되어 있습니다. 새로 만들어도 커밋하지 않도록 주의하세요.

---

## 9. 인수자가 가장 먼저 확인할 것 (체크리스트)

1. **Microsoft 365 / Azure AD 접근권**: 앱 등록(App Registration, clientId `3ca657f9-...`)과 테넌트(`32b8ffa5-...`) 관리 권한 확보. clientId/테넌트는 [authConfig.ts](src/authConfig.ts)에 있음.
2. **SharePoint 사이트 접근권**: `bitkr.sharepoint.com/sites/bit.kr` 및 위 13개 리스트의 편집 권한.
3. **GitHub 저장소 접근권**: push 권한 + GitHub Pages/Actions 설정 권한.
4. **부트스트랩 관리자 계정** 인수: `lyb77@bit.kr`, `show@bit.kr` (필요 시 본인 계정으로 교체 후 배포).
5. **EmailJS 계정**: 출고 메일용. 기본 키가 `settings.ts`에 하드코딩되어 있으니 계정 소유권을 확인하고, Gmail 연결이 끊기면 재연결.
6. 로컬에서 `npm install && npm run dev` 정상 동작 확인.

---

## 10. 알려진 이슈 / 개선 후보

- **주문 삭제 시 재고 미복원**: 7장 주문 등록 참고. 출고완료 건 삭제 시 재고 복원 또는 삭제 제한이 필요함.
- **하드코딩된 시크릿/설정**: MSAL clientId·테넌트, SharePoint URL, EmailJS 기본 키가 소스에 직접 포함. 클라이언트 사이드 앱 특성상 완전 비밀화는 어렵지만, 환경변수(`.env`)로 분리하면 관리/이관이 쉬움.
- **라우트 가드 부재**: 4.2절 참고. URL 직접 접근 차단이 없음.
- **임대 만료 알림 버그 가능성**: 7장 Rental 참고. `localStorage` 기반 + 없는 필드(`dong`) 참조.
- **권한 캐시 5분**: 권한 변경 즉시 반영 안 됨(최대 5분/재로그인 필요).
- **테스트 코드 없음**: 자동화 테스트 미비. 변경 후 `npx tsc --noEmit` 통과 확인과 수동 확인이 필요함.
- **에러 처리**: 다수 조회 함수가 실패 시 빈 배열을 반환(`catch → return []`)하므로, 데이터가 안 보일 때 네트워크/권한 에러가 콘솔에만 찍히고 화면엔 "데이터 없음"처럼 보일 수 있음. 디버깅 시 브라우저 콘솔 확인.
- **과거 날짜 데이터**: KST 수정 이전에 한국시간 0~9시에 입력된 거래는 하루 전 날짜로 저장되어 있을 수 있음.

---

## 11. 자주 하는 작업 가이드

| 작업 | 방법 |
|------|------|
| 사용자 권한 부여 | 관리자 로그인 → 관리자 페이지 → 권한 관리 탭 → 사용자 추가 |
| 항상 ADMIN인 계정 추가 | [src/auth/constants.ts](src/auth/constants.ts) `BOOTSTRAP_ADMINS`에 이메일 추가 후 배포 |
| 메일 발송 설정 변경 | 관리자 페이지 → 메일 설정 탭 (변경 후 테스트 발송으로 확인) |
| 새 메뉴 추가 | `menus.ts` + `App.tsx` 라우트 + `MenuKey` 타입 함께 수정 |
| 데이터 필드 추가 | SharePoint 리스트 컬럼 생성 → `storage.ts` 매핑 → `types.ts` |
| 주문 월 양식 변경 | `public/order-template.xlsx` 교체 + `excelService.ts`의 `TEMPLATE_LAYOUT`/`FIXED_COLS` 수정 |
| 배포 | `git push origin main` (Actions 자동 배포) |
| 운영 URL 변경 | `vite.config.ts`의 `base` + `authConfig.ts`의 `redirectUri` 동시 수정 |

---

문의가 필요한 핵심 파일 순서는 **`authConfig.ts` → `storage.ts` → `auth/AuthContext.tsx` → `constants/menus.ts`** 입니다. 이 네 개만 이해하면 시스템의 80%를 파악할 수 있습니다.
