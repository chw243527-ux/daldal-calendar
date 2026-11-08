# GitHub Actions 자동화

현재 저장소에는 다음 자동화가 설정되어 있습니다.

- `Check web app`: `main`에 Push 또는 Pull Request가 발생하면 의존성 설치, TypeScript 검사, 서버·웹앱 빌드를 실행합니다.
- `Build Android debug APK`: `main`에 Push할 때마다 갤럭시 S25에 설치할 수 있는 디버그 APK를 만들고 GitHub Actions Artifacts에 올립니다.
- `Build and publish container`: Docker 이미지를 `ghcr.io/chw243527-ux/daldal-calendar`에 올립니다.
- `Deploy web service`: Render Deploy Hook을 연결한 경우 웹 서비스를 자동 재배포합니다.

## Push 후 APK 받기

1. GitHub 저장소에서 **Actions** 탭을 엽니다.
2. `Build Android debug APK` 실행을 선택합니다.
3. 완료된 작업 아래 **Artifacts**에서 `daldal-calendar-debug-apk`를 다운로드합니다.
4. 압축을 풀고 `app-debug.apk`를 갤럭시 S25로 보내 설치합니다.

## 웹 자동 배포 연결

현재 앱은 Express 서버와 데이터베이스를 사용하므로 GitHub Pages보다 Docker 호스팅이 적합합니다. Render에서 이 저장소를 연결하고 `render.yaml`을 사용해 Web Service를 만든 뒤, Render의 Deploy Hook URL을 복사합니다.

GitHub 저장소에서 **Settings → Secrets and variables → Actions → New repository secret**으로 이동해 다음 Secret을 추가합니다.

```text
Name: RENDER_DEPLOY_HOOK_URL
Value: Render에서 발급한 Deploy Hook URL
```

이후 `main`에 Push하면 검사 workflow가 성공한 뒤 Render 자동 배포 workflow가 실행됩니다. 데이터베이스를 사용하는 경우 Render 환경변수에 `DATABASE_URL`도 별도로 입력해야 합니다.

## 현재 공개된 Manus 주소와의 관계

현재 공개 주소 `https://daldal-bsqjsoxw.manus.space`는 Manus 배포 버전입니다. GitHub Actions가 GitHub Push만으로 Manus 주소를 자동 갱신하지는 않습니다. GitHub Push 기반 자동 배포를 사용하려면 Render 같은 호스팅 서비스에 `render.yaml`을 연결해 별도 운영 주소를 만들거나, Manus용 배포 연동을 별도 설정해야 합니다.
