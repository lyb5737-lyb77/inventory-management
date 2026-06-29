# BIT 관리 시스템 — 인수인계 문서

> 사내 통합 자산/재고/임대 관리 웹 애플리케이션
> 최종 정리일: 2026-06-26

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
| `xlsx` (SheetJS) | 엑셀 업로드/다운로드 |
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

# 로컬 개발 서버 (Vite)
npm run dev

# 프로덕션 빌드 (tsc 타입체크 후 vite build, 메모리 8GB 할당)
npm run build
```

### 배포 (⚠️ 가장 중요)

배포는 **`main` 브랜치에 push** 하면 GitHub Actions(`.github/workflows/deploy.yml`)가 자동으로 빌드 후 GitHub Pages에 반영합니다.

```bash
git add .
git commit -m "수정 내용"
git push origin main
# → GitHub Actions 자동 빌드/배포 (약 1~2분 소요)
```

- 로컬에서 `npm run deploy`(`gh-pages`)를 돌려도, GitHub Actions가 우선 동작하므로 **반드시 push로 배포**하는 것을 권장합니다.
- `vite.config.ts`의 `base: '/inventory-management/'` 설정 때문에 GitHub Pages 경로가 고정되어 있습니다. 저장소 이름을 바꾸면 이 값도 같이 바꿔야 합니다.

---

## 4. 인증 & 권한 시스템

### 4.1 로그인 (MSAL / Azure AD)
- 설정 위치: [src/authConfig.ts](src/authConfig.ts)
- `clientId`, `authority`(테넌트)가 하드코딩되어 있음.
- 요청 권한(scope): `User.Read`, `Sites.ReadWrite.All`, `Mail.Send`, `Files.ReadWrite.All`
- `redirectUri`는 github.io 도메인이면 운영 URL, 아니면 `window.location.origin`(로컬)으로 자동 분기.
- 토큰은 `sessionStorage`에 캐싱 (브라우저 탭 닫으면 만료).

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
| `admin` | `/admin` | [AdminPage.tsx](src/pages/AdminPage.tsx) | 품목/제품그룹/창고/출고처/**권한** 관리 (탭 구성) |
| `inventory` | `/inventory` | [InventoryPage.tsx](src/pages/InventoryPage.tsx) | 입·출고 처리, 재고 현황, 검색, 엑셀 다운로드, 인쇄 |
| `outbound-request` | `/outbound-request` | [OutboundRequestPage.tsx](src/pages/OutboundRequestPage.tsx) | 창고 담당자에게 출고 요청 이메일 발송 + 거래 기록 |
| `rental` | `/rental` | [RentalPage.tsx](src/pages/RentalPage.tsx) | 임대 현황/계약 관리, 엑셀 업로드/다운로드 |
| `ip-management` | `/ip-management` | [IpManagementPage.tsx](src/pages/IpManagementPage.tsx) | IP 대역 및 IP별 사용 현황 관리 |
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

- [src/storage.ts](src/storage.ts): 가장 중요한 파일. 앱의 TypeScript 모델(`Item`, `Rental` 등)과 SharePoint 컬럼(`Title`, `Quantity` 등) 간 매핑을 모두 담당.
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
| ipRanges | `IpRanges` | IP 대역 |
| ipDetails | `IpDetails` | IP별 상세(사용자/부서/용도) |
| equipments | `Equipments` | 업무용 장비 |
| equipmentLogs | `EquipmentLogs` | 장비 변경 이력 |
| userPermissions | `UserPermissions` | 사용자 권한 |

### 6.3 ⚠️ SharePoint 사용 시 주의사항
- **수량/가격은 SharePoint에서 텍스트(문자열) 타입**으로 저장됨. 앱에서 `String()`/`parseInt()`로 변환 처리. (`storage.ts` 참고)
- 컬럼 내부명(internal name)은 표시명과 다를 수 있음. `Title`은 항상 첫 번째 기본 컬럼이며 도메인마다 다른 의미로 재활용됨:
  - Items → 품명, Rentals → 임대인명, EquipmentLogs → **장비 ID**, UserPermissions → **이메일**.
- 데이터 추가 시 400 에러가 나면 십중팔구 **리스트 컬럼명/타입 불일치**. (sharepoint.ts에 친절한 에러 메시지 있음)
- 새 필드를 추가하려면 ① SharePoint 리스트에 컬럼 생성 → ② `storage.ts`의 매핑 함수(get/add/update) 수정 → ③ `types.ts` 인터페이스 수정.

---

## 7. 도메인별 핵심 동작

### 재고/거래 (Inventory)
- 입고(IN)/출고(OUT) 거래를 `Transactions`에 기록하면서, 동시에 해당 품목의 `Quantity`(현재고)를 가감 업데이트 (`addTransaction` in `storage.ts`).
- 마이너스 재고 허용 (출고 시 재고보다 많아도 차감됨 — 음수 가능).
- 엑셀 다운로드 기능 제공.

### 출고 신청 (Outbound Request)
- 창고 담당자 이메일로 출고 요청 메일 발송. 발송 엔진은 **EmailJS** ([src/services/email.ts](src/services/email.ts)).
- EmailJS 키(`SERVICE_ID`/`TEMPLATE_ID`/`PUBLIC_KEY`)가 코드에 하드코딩되어 있음.

### 임대 관리 (Rental)
- 호실별 면적 매핑은 [src/constants/roomData.ts](src/constants/roomData.ts)에 고정값으로 정의 (101~402호).
- 엑셀 업로드/다운로드 지원 ([src/services/excelService.ts](src/services/excelService.ts)). 업로드 시 회사 양식(제목 1행, 헤더 1행)에 맞춰 3번째 행부터 파싱하며, 컬럼명 변형(공백 포함 등)에 폭넓게 대응.
- 홈 화면에서 계약 종료 3개월 이내 건을 alert로 알림.
  - ⚠️ **주의/버그 소지**: 이 만료 알림은 `localStorage`의 `rental_data`를 읽음(HomePage.tsx) — SharePoint 데이터가 아님. 또한 존재하지 않는 `dong` 필드를 참조함. 실제로는 동작하지 않을 가능성이 높으니 점검 필요.

### IP 자산 관리 (IP Management)
- IP 대역(`IpRanges`)을 등록하면 시작~종료 IP 사이를 자동 펼쳐(`generateIpListInRange`) 각 IP의 사용 현황(`IpDetails`)을 관리.
- 엑셀로 IP 사용 현황 일괄 업로드 가능.

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
│  │  ├─ email.ts                 # EmailJS 출고 메일
│  │  └─ excelService.ts          # 엑셀 입출력
│  ├─ constants/
│  │  ├─ menus.ts                 # 메뉴/라우트 정의
│  │  └─ roomData.ts              # 호실 면적표
│  ├─ components/
│  │  ├─ Layout.tsx               # 공통 헤더/로그아웃
│  │  └─ PermissionAdminPanel.tsx # 권한 관리 UI
│  └─ pages/                      # 각 화면
└─ (루트의 .xlsx/.cjs/.docx 등은 초기 데이터 마이그레이션용 보조 파일)
```

---

## 9. 인수자가 가장 먼저 확인할 것 (체크리스트)

1. **Microsoft 365 / Azure AD 접근권**: 앱 등록(App Registration, clientId `3ca657f9-...`)과 테넌트(`32b8ffa5-...`) 관리 권한 확보. clientId/테넌트는 [authConfig.ts](src/authConfig.ts)에 있음.
2. **SharePoint 사이트 접근권**: `bitkr.sharepoint.com/sites/bit.kr` 및 위 11개 리스트의 편집 권한.
3. **GitHub 저장소 접근권**: push 권한 + GitHub Pages/Actions 설정 권한.
4. **부트스트랩 관리자 계정** 인수: `lyb77@bit.kr`, `show@bit.kr` (필요 시 본인 계정으로 교체 후 배포).
5. **EmailJS 계정**: 출고 메일용. 키가 코드에 하드코딩되어 있으니 계정 소유권 확인.
6. 로컬에서 `npm install && npm run dev` 정상 동작 확인.

---

## 10. 알려진 이슈 / 개선 후보

- **하드코딩된 시크릿/설정**: MSAL clientId·테넌트, SharePoint URL, EmailJS 키가 소스에 직접 포함. 클라이언트 사이드 앱 특성상 완전 비밀화는 어렵지만, 환경변수(`.env`)로 분리하면 관리/이관이 쉬움.
- **라우트 가드 부재**: 6장·4.2절 참고. URL 직접 접근 차단이 없음.
- **임대 만료 알림 버그 가능성**: 7장 Rental 참고. `localStorage` 기반 + 없는 필드(`dong`) 참조.
- **권한 캐시 5분**: 권한 변경 즉시 반영 안 됨(최대 5분/재로그인 필요).
- **테스트 코드 없음**: 자동화 테스트 미비. 변경 후 수동 확인 필요.
- **에러 처리**: 다수 조회 함수가 실패 시 빈 배열을 반환(`catch → return []`)하므로, 데이터가 안 보일 때 네트워크/권한 에러가 콘솔에만 찍히고 화면엔 "데이터 없음"처럼 보일 수 있음. 디버깅 시 브라우저 콘솔 확인.

---

## 11. 자주 하는 작업 가이드

| 작업 | 방법 |
|------|------|
| 사용자 권한 부여 | 관리자 로그인 → 관리자 페이지 → 권한 관리 탭 → 사용자 추가 |
| 항상 ADMIN인 계정 추가 | [src/auth/constants.ts](src/auth/constants.ts) `BOOTSTRAP_ADMINS`에 이메일 추가 후 배포 |
| 새 메뉴 추가 | `menus.ts` + `App.tsx` 라우트 + `MenuKey` 타입 함께 수정 |
| 데이터 필드 추가 | SharePoint 리스트 컬럼 생성 → `storage.ts` 매핑 → `types.ts` |
| 배포 | `git push origin main` (Actions 자동 배포) |
| 운영 URL 변경 | `vite.config.ts`의 `base` + `authConfig.ts`의 `redirectUri` 동시 수정 |

---

문의가 필요한 핵심 파일 순서: **`authConfig.ts` → `storage.ts` → `auth/AuthContext.tsx` → `constants/menus.ts`**. 이 네 개만 이해하면 시스템의 80%를 파악할 수 있습니다.
