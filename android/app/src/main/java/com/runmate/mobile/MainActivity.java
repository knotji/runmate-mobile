package com.runmate.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackgroundHealthPlugin.class);
        registerPlugin(StoryImagePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
