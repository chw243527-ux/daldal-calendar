package com.daldal.calendar;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import java.text.NumberFormat;
import java.util.Locale;

public class DaldalWidgetProvider extends AppWidgetProvider {
    private static final String PREFS = "daldal_widget";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) updateWidget(context, manager, id);
    }

    public static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        int todoCount = preferences.getInt("todoCount", 0);
        int eventCount = preferences.getInt("eventCount", 0);
        int balance = preferences.getInt("balance", 0);
        String dateLabel = preferences.getString("dateLabel", "오늘");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.daldal_widget);
        views.setTextViewText(R.id.widget_date, dateLabel);
        views.setTextViewText(R.id.widget_summary, "할 일 " + todoCount + "개 · 일정 " + eventCount + "개");
        views.setTextViewText(R.id.widget_balance, "잔액 " + NumberFormat.getNumberInstance(Locale.KOREA).format(balance) + "원");

        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent != null) {
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context,
                    0,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_title, pendingIntent);
        }

        manager.updateAppWidget(widgetId, views);
    }
}
