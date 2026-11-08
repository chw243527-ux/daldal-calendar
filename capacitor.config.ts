import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.daldal.calendar",
  appName: "달달 캘린더",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
  },
};

export default config;
