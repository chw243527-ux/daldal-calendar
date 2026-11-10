import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.daldal.calendar",
  appName: "달달 캘린더",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
    // APK와 웹이 같은 로그인·세션·기능을 사용하도록 공개 웹앱을 로드합니다.
    url: "https://daldal-bsqjsoxw.manus.space",
  },
};

export default config;
