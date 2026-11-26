# 작업 체크리스트 — 업무 계정 관리 메뉴 (C-1)

기획서는 [ACCOUNT_VAULT_PLAN.md](ACCOUNT_VAULT_PLAN.md) 14장, 결정 근거는 [context-notes.md](context-notes.md)를 보세요.

## 문서
- [x] 기획서에 확정 사항과 C-1 설계 반영
- [x] 체크리스트, 결정 기록 작성

## 개발
- [x] `sharepoint.ts` 항목 생성 시 데이터 전체를 콘솔에 출력하는 로그 제거
- [x] `types.ts`에 `SiteAccount` 타입 추가
- [x] `authConfig.ts`에 `SiteAccounts`, `SiteAccountKeys` 리스트명 추가
- [x] `storage.ts`에 계정 CRUD와 키 조회·생성 함수 추가
- [x] `services/vaultCrypto.ts` — AES-256-GCM 암호화·복호화, 키 생성
- [x] `menus.ts`에 `account-vault` 메뉴, `App.tsx`에 라우트 추가
- [x] `pages/AccountVaultPage.tsx` — 진입 권한 확인, 목록·필터·검색, 보기·복사·사이트 열기, 등록·수정·삭제, 키 생성, 변경 주기 표시

## 검증
- [x] `npx tsc --noEmit` 통과
- [x] 브라우저에서 암호화→복호화 왕복, 잘못된 키로 복호화 실패 확인
- [x] 브라우저에서 번들 로드·콘솔 에러 없음 확인
- [x] 화면 필터 로직(관리자 전체, 담당자, 볼 수 있는 사용자) 확인
- [x] 콘솔에 키나 평문 비밀번호가 출력되지 않는지 확인

## 마무리
- [x] HANDOVER.md 갱신 (메뉴, 리스트 13개, 기능 설명)
- [x] 커밋
- [x] 사용자: SharePoint 리스트 2개 생성과 권한 설정 (기획서 14.2~14.3)
- [x] 사용자: 관리자 계정으로 암호화 키 생성 후 오프라인 백업
- [x] 배포
