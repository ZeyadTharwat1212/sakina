package dev.zeyad.sakina;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** leaving the app → the widget picks up any new times / language right away */
    @Override public void onPause() { super.onPause(); try { SakinaWidget.refresh(this); } catch (Exception ignored) {} }
}
