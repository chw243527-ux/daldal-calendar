import { Capacitor, registerPlugin } from "@capacitor/core";

type LockScreenConfig = {
  showCalendar: boolean;
  showSchedule: boolean;
  showTodo: boolean;
  showMonthlyFunds: boolean;
  backgroundTheme: "ivory" | "blush" | "sage" | "night";
};

type WidgetData = {
  todoCount: number;
  eventCount: number;
  balance: number;
  dateLabel: string;
  monthLabel?: string;
  lockScreenConfig?: LockScreenConfig;
  /** Capacitor Java 플러그인이 읽을 수 있도록 JSON 문자열로 전달합니다. */
  calendarItems?: string;
  /** 앱 달력과 같은 양력 날짜별 음력 표기 */
  lunarCalendar?: string;
};

type DaldalWidgetPlugin = {
  setData(options: WidgetData): Promise<void>;
};

const DaldalWidget = registerPlugin<DaldalWidgetPlugin>("DaldalWidget");

export async function syncNativeWidget(data: WidgetData) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await DaldalWidget.setData(data);
  } catch (error) {
    console.warn("[Native Widget] sync failed", error);
  }
}
