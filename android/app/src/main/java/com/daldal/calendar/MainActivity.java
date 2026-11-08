package com.daldal.calendar;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public MainActivity() {
        registerPlugin(DaldalWidgetPlugin.class);
        registerPlugin(DaldalWallpaperPlugin.class);
    }
}
