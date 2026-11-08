import { Capacitor, registerPlugin } from "@capacitor/core";

type DaldalWidgetPlugin = {
  setData(options: {
    todoCount: number;
    eventCount: number;
    balance: number;
    dateLabel: string;
  }): Promise<void>;
};

const DaldalWidget = registerPlugin<DaldalWidgetPlugin>("DaldalWidget");

export async function syncNativeWidget(data: {
  todoCount: number;
  eventCount: number;
  balance: number;
  dateLabel: string;
}) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await DaldalWidget.setData(data);
  } catch (error) {
    console.warn("[Native Widget] sync failed", error);
  }
}
