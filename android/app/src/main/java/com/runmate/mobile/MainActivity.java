package com.runmate.mobile;

import android.os.Bundle;
import android.content.Intent;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackgroundHealthPlugin.class);
        registerPlugin(ExerciseRoutePlugin.class);
        registerPlugin(SharedGpxPlugin.class);
        registerPlugin(StoryImagePlugin.class);
        registerPlugin(TodayPlanWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        PluginHandle handle = getBridge().getPlugin("SharedGpx");
        if (handle != null && handle.getInstance() instanceof SharedGpxPlugin) {
            ((SharedGpxPlugin) handle.getInstance()).captureIntent(intent, true);
        }
    }
}
