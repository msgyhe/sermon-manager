# 앱 업데이트 배포 안내

앱에는 수동 업데이트 확인, 다운로드 진행률, 재시작 설치, 설치 직전 자동 백업 기능이 포함되어 있습니다.

## 1. GitHub 저장소 준비

공개 GitHub 저장소 `msgyhe/sermon-manager`의 Releases를 업데이트 배포 서버로 사용합니다.

## 2. 앱 연결

`package.json`의 `build.publish`가 GitHub 저장소를 가리킵니다. 설치된 앱은 내장된 `app-update.yml`을 통해 GitHub Releases에서 새 버전을 확인합니다.

## 3. 새 버전 게시

1. `package.json`의 `version`을 이전 버전보다 높입니다.
2. `npm.cmd run build:desktop`을 실행합니다.
3. `GH_TOKEN` 환경 변수를 설정하고 `npx electron-builder --win nsis --publish always`를 실행하거나, 빌드 출력 폴더의 `latest.yml`, 설치 파일 `.exe`, `.exe.blockmap`을 같은 GitHub Release에 업로드합니다.
4. 이전 버전 앱에서 `설정 > 앱 업데이트 > 업데이트 확인`을 실행합니다.

Git 태그와 Release 버전은 `v0.1.4`처럼 앱 버전과 맞추는 것을 권장합니다. 업데이트 파일 세 개의 이름을 임의로 변경하면 안 됩니다. 설치 파일에는 운영 배포 전에 Windows 코드 서명을 적용하는 것을 권장합니다.

## 4. 동작 순서

1. 사용자가 업데이트를 확인합니다.
2. 새 버전이 있으면 사용자가 다운로드를 시작합니다.
3. 화면에 다운로드 비율과 용량이 표시됩니다.
4. 사용자가 재시작 설치를 선택하면 SQLite 데이터를 자동 백업합니다.
5. 앱이 종료되고 새 버전이 설치된 뒤 다시 실행됩니다.
