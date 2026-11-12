package com.daldal.calendar;

import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public MainActivity() {
        registerPlugin(DaldalWidgetPlugin.class);
        registerPlugin(DaldalWallpaperPlugin.class);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ensureSystemBarsVisible();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Capacitor 화면 전환 뒤에도 앱 상태바가 다시 숨겨지지 않게 합니다.
        ensureSystemBarsVisible();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) ensureSystemBarsVisible();
    }

    private void ensureSystemBarsVisible() {
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && getWindow().getInsetsController() != null) {
            getWindow().getInsetsController().show(WindowInsets.Type.statusBars());
        }
    }
}
