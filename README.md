# BIT Management (재고/임대 관리 시스템)

## 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

## 빌드 및 배포 (중요)

이 프로젝트는 GitHub Pages를 통해 호스팅 되며, 기본적으로 `npm run deploy` 명령어를 사용하여 빌드와 배포를 동시에 수행하도록 설정되어 있습니다.

### ⚠️ 배포 시 주의사항 및 해결 방법 (Troubleshooting)

종종 Windows 환경 등에서 `npm run deploy` 실행 시, `predeploy` 단계(`npm run build`)까지는 정상적으로 수행되지만 이후 `gh-pages` 배포 단계로 넘어가지 못하고 **Exit code: 1**을 반환하며 실패하는 에러가 발생할 수 있습니다.

해당 현상이 발생하면 당황하지 마시고, **빌드와 배포 명령어를 분리하여 직접 실행**하면 정상적으로 배포할 수 있습니다.

**배포가 실패할 때의 수동 조치 방법:**
1. 먼저 스크립트를 수동으로 빌드합니다.
   ```bash
   npm run build
   ```
2. 생성된 `dist` 폴더를 `gh-pages`를 통해 직접 푸시(배포)합니다.
   ```bash
   npx gh-pages -d dist
   ```

이 방법을 사용하면 배포 중단 스크립트 오류를 우회하여 정상적으로 GitHub Pages에 업데이트를 반영할 수 있습니다.
