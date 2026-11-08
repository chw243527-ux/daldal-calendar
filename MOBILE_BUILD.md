# 달달 캘린더 네이티브 앱 빌드 안내

현재 저장소에는 웹앱과 함께 Capacitor Android/iOS 프로젝트가 생성되어 있습니다. 웹앱은 `dist/public`으로 빌드되고, Capacitor가 이 결과물을 각 네이티브 앱에 복사합니다.

## 공통 준비

```bash
pnpm install
pnpm mobile:sync
```

`pnpm mobile:sync`는 웹앱을 빌드하고 Android/iOS 프로젝트에 최신 파일을 복사합니다.

## Android APK와 홈 화면 위젯

Android Studio가 설치된 컴퓨터에서 다음 명령을 실행합니다.

```bash
pnpm mobile:android
```

Android Studio가 열리면 기기 또는 에뮬레이터를 선택한 뒤 Run을 누릅니다. APK를 직접 만들려면 Android Studio의 Build 메뉴에서 APK를 생성하거나 다음을 사용합니다.

```bash
cd android
./gradlew assembleDebug
```

완성된 APK는 `android/app/build/outputs/apk/debug/app-debug.apk`에 생성됩니다. Google Play 배포용은 Android Studio의 Generate Signed Bundle/APK에서 **Android App Bundle (AAB)** 을 선택합니다.

현재 Android 프로젝트에는 `DaldalWidgetProvider`가 포함되어 있습니다. 이 위젯은 달달 캘린더의 오늘 할 일 수, 오늘 일정 수, 이번 달 잔액을 보여주고 누르면 앱을 엽니다. `widgetCategory`는 `home_screen|keyguard`로 선언되어 갤럭시 S25의 지원되는 잠금화면/Brief 위젯 목록에도 노출될 수 있습니다. 앱의 웹 화면에서 데이터가 바뀌면 Capacitor 브리지를 통해 위젯 데이터도 갱신됩니다.

Android에서는 기기 제조사와 OS 버전에 따라 잠금화면 위젯이 제한될 수 있습니다. 따라서 기본 구현은 안정적인 **홈 화면 위젯**을 대상으로 하며, 잠금화면에서는 일정 알림을 함께 사용하는 방식이 안전합니다.

## 라이브 배경화면

최신 Android APK에는 `DaldalLiveWallpaperService`가 포함되어 앱이 저장한 월간 기록과 오늘 요약을 직접 그리는 라이브 배경화면을 제공합니다. 갤럭시 S25에서 `설정 → 배경화면 및 스타일 → 배경화면 변경 → 라이브 배경화면`으로 이동해 `달달 캘린더 라이브 배경화면`을 선택하고 적용합니다. 라이브 배경화면은 표시용이며 기록 입력은 앱에서 합니다.

## iPhone 앱과 잠금화면 위젯

iOS 앱 빌드는 macOS와 Xcode가 필요합니다.

```bash
pnpm mobile:ios
```

Xcode에서 `ios/App/App.xcodeproj`를 열고 Signing & Capabilities에서 Apple Developer Team을 선택합니다. 실제 iPhone을 연결하거나 시뮬레이터를 선택한 뒤 Run을 누릅니다. TestFlight 배포는 Product → Archive → Distribute App 순서로 진행합니다.

잠금화면 위젯은 Xcode에서 다음 타깃을 추가합니다.

1. File → New → Target
2. Widget Extension 선택
3. 이름을 `DaldalWidgetExtension`으로 지정
4. `ios/DaldalWidgetExtension/DaldalWidget.swift`의 예제 코드를 새 타깃에 추가
5. `accessoryCircular`, `accessoryRectangular`, `accessoryInline` 위젯을 확인
6. 실제 데이터 연동 시 App Group을 앱 타깃과 위젯 타깃에 함께 추가

현재 Swift 파일은 WidgetKit 화면 틀을 제공하는 템플릿입니다. 실제 앱 데이터와 연결하려면 웹앱의 기록을 네이티브 저장소 또는 서버에 동기화하고, 위젯의 `TimelineProvider`에서 그 데이터를 읽도록 연결해야 합니다.

## 스마트폰에서 테스트할 때

Android는 Android Studio에서 USB 디버깅을 켠 기기를 선택하고 Run을 누른 뒤, 홈 화면을 길게 눌러 위젯 메뉴에서 `달달 캘린더`를 추가합니다. 잠금화면에서는 `설정 → 배경화면 및 스타일 → 현재 잠금화면 → 위젯 추가`에서 `달달 캘린더`를 선택합니다. One UI의 Brief 위젯 지원 목록과 표시 방식은 기기·소프트웨어 버전에 따라 달라질 수 있습니다.

iPhone은 Xcode에서 앱을 설치한 뒤 잠금화면을 길게 누르고 사용자화 → 잠금화면 → 위젯 영역을 눌러 `달달 캘린더`를 추가합니다.

## 주의사항

PWA 설치만으로는 잠금화면 위젯을 만들 수 없습니다. PWA는 홈 화면에 앱처럼 설치할 수 있지만, iOS 잠금화면 위젯은 WidgetKit 확장, Android 위젯은 네이티브 AppWidget이 필요합니다. 또한 현재 개발 환경에는 Xcode와 Android SDK가 없으므로 이 저장소에서 네이티브 프로젝트와 코드는 생성했지만, 최종 APK/IPA 빌드는 해당 개발 도구가 설치된 컴퓨터에서 수행해야 합니다.
