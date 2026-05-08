# BIT Management (재고/임대 관리 시스템)

## 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

## 빌드 및 배포 (중요)

이 프로젝트는 **GitHub Actions (`.github/workflows/deploy.yml`)**를 통해 자동으로 GitHub Pages에 빌드 및 배포됩니다.

### ⚠️ 배포 시 주의사항 (Troubleshooting)

이 프로젝트를 수정하고 배포 결과를 확인하려면, 반드시 수정한 파일들을 **`main` 브랜치에 Commit 후 Push** 해야 합니다. 단순히 코드를 로컬 컴퓨터에만 저장하거나, 수동 명령어(`npm run deploy`, `gh-pages`)만 실행해서는 실제 라이브 환경에 반영되지 않습니다. GitHub 설정 상 Actions가 가장 최우선으로 작동하기 때문입니다.

**올바른 배포 Workflow:**
1. 코드 수정 완료
2. `git add .` (수정된 파일 스테이징)
3. `git commit -m "수정 내용 메시지"` (커밋)
4. `git push origin main` (원격 저장소 main 브랜치로 푸시)
5. GitHub 서버 측에서 자동으로 빌드 및 배포 대기 (1~2분 소요)
6. 변경사항 확인

**만약 수동 배포가 꼭 필요한 경우:**
간혹 로컬 환경에서 `npm run deploy` 실행 시 `gh-pages` 빌드 오류(Exit code: 1)가 날 수 있습니다. 이럴 경우에만 아래의 절차로 강제 수동 배포를 진행할 수 있지만, 기본적으로는 **Git Push를 통한 환경**을 권장합니다.
```bash
npm run build
npx gh-pages -d dist
```
