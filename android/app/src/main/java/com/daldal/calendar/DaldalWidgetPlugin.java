package com.daldal.calendar;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DaldalWidget")
public class DaldalWidgetPlugin extends Plugin {
    private static final String PREFS = "daldal_widget";

    @PluginMethod
    public void setData(PluginCall call) {
        int todoCount = call.getInt("todoCount", 0);
        int eventCount = call.getInt("eventCount", 0);
        int balance = call.getInt("balance", 0);
        String dateLabel = call.getString("dateLabel", "오늘");
        String monthLabel = call.getString("monthLabel", "달달 캘린더");
        String calendarItems = call.getString("calendarItems", "[]");
        JSObject lockScreenConfig = call.getObject("lockScreenConfig");
        boolean showCalendar = lockScreenConfig == null || !lockScreenConfig.has("showCalendar") || Boolean.TRUE.equals(lockScreenConfig.opt("showCalendar"));
        boolean showSchedule = lockScreenConfig == null || !lockScreenConfig.has("showSchedule") || Boolean.TRUE.equals(lockScreenConfig.opt("showSchedule"));
        boolean showTodo = lockScreenConfig == null || !lockScreenConfig.has("showTodo") || Boolean.TRUE.equals(lockScreenConfig.opt("showTodo"));
        boolean showMonthlyFunds = lockScreenConfig == null || !lockScreenConfig.has("showMonthlyFunds") || Boolean.TRUE.equals(lockScreenConfig.opt("showMonthlyFunds"));

        SharedPreferences preferences = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        preferences.edit()
                .putInt("todoCount", todoCount)
                .putInt("eventCount", eventCount)
                .putInt("balance", balance)
                .putString("dateLabel", dateLabel)
                .putString("monthLabel", monthLabel)
                .putString("calendarItems", calendarItems)
                .putBoolean("showCalendar", showCalendar)
                .putBoolean("showSchedule", showSchedule)
                .putBoolean("showTodo", showTodo)
                .putBoolean("showMonthlyFunds", showMonthlyFunds)
                .apply();

        AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
        int[] ids = manager.getAppWidgetIds(new android.content.ComponentName(getContext(), DaldalWidgetProvider.class));
        for (int id : ids) {
            DaldalWidgetProvider.updateWidget(getContext(), manager, id);
        }

        call.resolve(new JSObject());
    }
}
