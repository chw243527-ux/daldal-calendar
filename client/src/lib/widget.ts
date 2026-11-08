import { Capacitor, registerPlugin } from "@capacitor/core";

type DaldalWidgetPlugin = {
  setData(options: {
    todoCount: number;
    eventCount: number;
    balance: number;
    dateLabel: string;
    monthLabel?: string;
    calendarItems?: Array<{
      type: "todo" | "event" | "income" | "expense" | "loan";
      title: string;
      date: string;
      time?: string;
      amount?: number;
      completed?: boolean;
    }>;
  }): Promise<void>;
};

const DaldalWidget = registerPlugin<DaldalWidgetPlugin>("DaldalWidget");

export async function syncNativeWidget(data: {
  todoCount: number;
  eventCount: number;
  balance: number;
  dateLabel: string;
  monthLabel?: string;
  calendarItems?: Array<{
    type: "todo" | "event" | "income" | "expense" | "loan";
    title: string;
    date: string;
    time?: string;
    amount?: number;
    completed?: boolean;
  }>;
}) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await DaldalWidget.setData(data);
  } catch (error) {
    console.warn("[Native Widget] sync failed", error);
  }
}
