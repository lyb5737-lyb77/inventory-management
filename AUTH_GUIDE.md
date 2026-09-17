# 로그인(인증) 방식 가이드 — 다른 프로젝트 이식용

이 문서는 BIT 관리 시스템(`inventory-management`)에서 사용 중인 **Microsoft 계정 로그인 방식**을 다른 웹 프로젝트에도 동일하게 적용할 수 있도록, 실제 코드 기준으로 정리한 문서입니다.

## 핵심 개념

- **백엔드 서버 없이** 브라우저(SPA)에서 Microsoft Entra ID(옛 Azure AD)로 직접 로그인하는 방식입니다.
- 로그인 성공 시 발급되는 토큰으로 **Microsoft Graph API**(SharePoint, 메일 등)를 브라우저에서 바로 호출합니다.
- 특정 조직(`bit.kr`) 계정만 로그인 가능하도록 **테넌트(tenant)를 고정**해서 제한합니다.
- 사용 라이브러리는 Microsoft 공식 SDK인 **MSAL.js**(`@azure/msal-browser` + `@azure/msal-react`)입니다.

## 사용 패키지 및 버전

```json
"@azure/msal-browser": "^3.30.0",
"@azure/msal-react": "^2.0.11",
"@microsoft/microsoft-graph-client": "^3.0.7"
```

새 프로젝트에서도 동일하게 설치하면 됩니다.

```bash
npm install @azure/msal-browser @azure/msal-react @microsoft/microsoft-graph-client
```

## 사전 준비 — Azure Portal 앱 등록

로그인이 동작하려면 **새 프로젝트마다 자체 앱 등록(App Registration)이 필요**합니다. 기존 BIT 프로젝트의 clientId를 그대로 복사해서 쓰면 안 됩니다(도메인/리다이렉트 URI가 다르기 때문).

1. Azure Portal → **Microsoft Entra ID** → **앱 등록** → **새 등록**
2. **지원되는 계정 유형** — 특정 조직 계정만 허용하려면 **"이 조직 디렉터리만"** 선택 (BIT는 이렇게 설정되어 있어 bit.kr 계정만 로그인 가능)
3. **리디렉션 URI** — 플랫폼을 **SPA(단일 페이지 애플리케이션)**로 선택하고, 실제 배포될 URL(예: `https://your-domain.github.io/your-repo/`)과 로컬 개발 주소(`http://localhost:5173`)를 둘 다 등록
4. **API 권한** 추가(Microsoft Graph, 위임된 권한) — 필요한 것만 최소로 선택
   - `User.Read` — 로그인한 사용자 기본 정보 (거의 항상 필요)
   - `Sites.ReadWrite.All` — SharePoint 리스트를 DB처럼 쓸 경우
   - `Mail.Send` — 로그인 계정으로 메일 발송할 경우
   - `Files.ReadWrite.All` — OneDrive/SharePoint 파일 다룰 경우
5. 일부 권한(`Sites.ReadWrite.All` 등)은 **관리자 동의(Admin Consent)**가 필요합니다. 조직 관리자 계정으로 승인해야 합니다.
6. 등록 완료 후 **애플리케이션(클라이언트) ID**와 **디렉터리(테넌트) ID**를 복사해 둡니다.

## 핵심 구성 파일

### 1. `src/authConfig.ts` — MSAL 설정 (가장 중요한 파일)

```ts
import { Configuration, PublicClientApplication } from '@azure/msal-browser';

export const msalConfig: Configuration = {
    auth: {
        clientId: '3ca657f9-ff46-4322-b8d3-640565067857',       // Azure 앱 등록의 "애플리케이션(클라이언트) ID"
        authority: 'https://login.microsoftonline.com/32b8ffa5-83e1-4600-8ef4-09d1482fceab', // 테넌트(조직) ID — 특정 조직 계정만 로그인되게 만드는 핵심
        redirectUri: window.location.hostname.includes('github.io')
            ? 'https://lyb5737-lyb77.github.io/inventory-management/'  // 배포 환경 URL
            : window.location.origin,                                  // 로컬 개발 환경은 자동 감지
    },
    cache: {
        cacheLocation: 'sessionStorage',   // 탭을 닫으면 로그인 세션도 사라짐 (localStorage로 바꾸면 더 오래 유지)
        storeAuthStateInCookie: false,
    },
};

export const loginRequest = {
    scopes: ['User.Read', 'Sites.ReadWrite.All', 'Mail.Send', 'Files.ReadWrite.All'], // 필요한 Graph 권한만 나열
};

export const msalInstance = new PublicClientApplication(msalConfig);
```

새 프로젝트에 적용할 때 바꿔야 할 값

- `clientId` → 새로 등록한 앱의 클라이언트 ID
- `authority` 안의 GUID → 새 앱(또는 재사용할 조직)의 테넌트 ID
- `redirectUri` → 실제 배포 도메인에 맞게 수정
- `scopes` → 실제로 필요한 Graph 권한만

### 2. `src/main.tsx` — MSAL 초기화 후 렌더링

```tsx
import { msalInstance } from './authConfig';

msalInstance.initialize().then(() => {
    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
});
```

`msalInstance.initialize()`가 끝난 **다음에** React 앱을 렌더링해야 합니다. 순서가 바뀌면 로그인 관련 오류가 날 수 있습니다.

### 3. `src/App.tsx` — 로그인 여부에 따른 화면 분기

```tsx
import { MsalProvider, AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { msalInstance } from './authConfig';

function App() {
    return (
        <MsalProvider instance={msalInstance}>
            <AuthenticatedTemplate>
                {/* 로그인된 사용자에게 보여줄 화면 (라우팅 등) */}
            </AuthenticatedTemplate>
            <UnauthenticatedTemplate>
                <LoginPage />
            </UnauthenticatedTemplate>
        </MsalProvider>
    );
}
```

`AuthenticatedTemplate`/`UnauthenticatedTemplate`가 로그인 상태를 자동으로 감지해서 보여줄 화면을 바꿔줍니다. 별도의 상태 관리 코드가 필요 없습니다.

### 4. 로그인 버튼 (`loginPopup`)

```tsx
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../authConfig';

const { instance } = useMsal();

const handleLogin = () => {
    instance.loginPopup(loginRequest).catch(e => console.error(e));
};
```

`loginPopup`은 팝업 창으로 Microsoft 로그인 화면을 띄웁니다. (팝업 대신 전체 페이지 리다이렉트 방식인 `loginRedirect`도 있지만, 이 프로젝트는 팝업 방식을 사용합니다.)

### 5. 로그아웃 버튼 (`logoutPopup`)

```tsx
const { instance } = useMsal();

const handleLogout = () => {
    instance.logoutPopup().catch(e => console.error(e));
};
```

### 6. Microsoft Graph API 호출 (로그인 토큰으로 SharePoint/메일 등 접근)

```ts
import { Client } from '@microsoft/microsoft-graph-client';
import { msalInstance } from '../authConfig';

export const getGraphClient = async (): Promise<Client> => {
    const account = msalInstance.getAllAccounts()[0];
    if (!account) throw new Error('No account found. Please login first.');

    const tokenResponse = await msalInstance.acquireTokenSilent({
        scopes: ['Sites.ReadWrite.All', 'Mail.Send'],
        account: account,
    });

    return Client.init({
        authProvider: (done) => done(null, tokenResponse.accessToken),
    });
};
```

`acquireTokenSilent`는 이미 로그인된 세션에서 **팝업 없이 조용히** 토큰을 갱신해 줍니다. 이 클라이언트로 SharePoint 리스트를 DB처럼 읽고 쓰는 방식은 이 프로젝트의 `src/storage.ts`, `src/services/sharepoint.ts`를 참고하면 됩니다.

## 전체 동작 흐름

1. 앱 시작 → `msalInstance.initialize()` 완료 후 렌더링
2. 로그인 안 된 상태 → `UnauthenticatedTemplate` → `LoginPage` 노출
3. 사용자가 로그인 버튼 클릭 → `loginPopup()` → Microsoft 로그인 팝업 → 계정 인증
4. 인증 성공 → MSAL이 내부적으로 로그인 상태 전환 → `AuthenticatedTemplate`로 자동 전환
5. 이후 필요할 때마다 `acquireTokenSilent()`로 토큰을 얻어 Graph API 호출
6. 로그아웃 버튼 클릭 → `logoutPopup()` → 세션 종료 → 다시 `UnauthenticatedTemplate`로 전환

## (선택) 역할·메뉴 권한 시스템 — 이 프로젝트의 추가 레이어

로그인 자체와는 별개로, 이 프로젝트는 **"로그인은 됐지만 메뉴별로 접근 권한을 다르게 주는" 커스텀 레이어**를 SharePoint 리스트 기반으로 추가 구현했습니다. 다른 프로젝트에서도 역할 기반 접근 제어가 필요하면 참고할 수 있습니다.

- **부트스트랩 관리자**(`src/auth/constants.ts`) — SharePoint 데이터가 비어 있거나 오류가 나도 항상 관리자 권한을 갖는 이메일 화이트리스트. 시스템 락아웃 방지용 안전장치입니다.
  ```ts
  export const BOOTSTRAP_ADMINS: string[] = ['lyb77@bit.kr', 'show@bit.kr'];
  ```
- **권한 데이터**는 SharePoint `UserPermissions` 리스트에 저장 (이메일, 역할, 허용 메뉴 CSV, 활성 여부)
- **세션 캐시**(`sessionStorage`, 5분 TTL)로 매 페이지 이동마다 SharePoint를 다시 조회하지 않도록 최적화
- `useAuth()` / `usePermission()` 훅으로 어느 컴포넌트에서든 `canAccess('메뉴키')`처럼 권한을 확인

이 레이어는 **로그인 자체와 무관**하며, "역할별로 다른 화면을 보여주고 싶다"는 요구가 있을 때만 이식하면 됩니다.

## 다른 프로젝트 적용 체크리스트

- [ ] Azure Portal에서 새 앱 등록 (SPA 플랫폼, 리디렉션 URI 등록)
- [ ] 필요한 Graph API 권한 선택 + 관리자 동의
- [ ] `npm install @azure/msal-browser @azure/msal-react @microsoft/microsoft-graph-client`
- [ ] `authConfig.ts` 작성 (clientId·authority·redirectUri·scopes를 새 프로젝트 값으로 교체)
- [ ] `main.tsx`에서 `msalInstance.initialize()` 이후 렌더링하도록 구성
- [ ] `App.tsx`에 `MsalProvider` + `AuthenticatedTemplate`/`UnauthenticatedTemplate` 배치
- [ ] 로그인 페이지에 `loginPopup(loginRequest)` 버튼 추가
- [ ] 로그아웃 버튼에 `logoutPopup()` 추가
- [ ] Graph API가 필요하면 `getGraphClient()` 패턴으로 토큰 재사용
- [ ] (선택) 역할별 메뉴 접근 제어가 필요하면 권한 시스템 레이어 이식

## 주의사항 및 제약

- **백엔드가 없는 순수 브라우저 인증**이라, 서버 쪽에서 사용자를 대신해 API를 호출하는 구조(서비스 계정 등)는 만들 수 없습니다. 모든 요청은 로그인한 사용자 본인의 권한으로만 실행됩니다.
- `cacheLocation: 'sessionStorage'`이므로 **브라우저 탭을 닫으면 로그인 세션이 사라집니다.** 로그인을 더 오래 유지하고 싶으면 `localStorage`로 바꿀 수 있지만, 공용 PC 등에서는 보안상 권장하지 않습니다.
- **팝업 차단**이 되어 있으면 `loginPopup`/`logoutPopup`이 실패합니다. 사용자에게 팝업 허용 안내가 필요할 수 있습니다.
- 특정 조직 계정만 로그인되게 하려면 앱 등록 시 **"이 조직 디렉터리만"**을 선택하고, `authConfig.ts`의 `authority`에 해당 **테넌트 GUID**를 정확히 넣어야 합니다. 여기가 "회사 계정만 로그인 가능"의 실질적인 제한 지점입니다.
- `Sites.ReadWrite.All` 같은 강한 권한은 조직 관리자의 **사전 동의**가 없으면 로그인 시 권한 요청이 실패합니다.
