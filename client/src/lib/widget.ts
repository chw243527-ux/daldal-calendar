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
  calendarItems?: Array<{
    type: "todo" | "event" | "income" | "expense" | "transfer" | "loan" | "savings";
    title: string;
    date: string;
    time?: string;
    amount?: number;
    completed?: boolean;
  }>;
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
