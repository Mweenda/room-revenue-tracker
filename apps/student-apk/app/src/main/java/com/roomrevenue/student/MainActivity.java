package com.roomrevenue.student;

import android.annotation.SuppressLint;
import android.content.res.Configuration;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    public static final String PORTAL_URL = "https://room-revenue-tracker.web.app/?app=student";
    private static final String RESIZE_SCRIPT =
        "(function(){window.dispatchEvent(new Event('resize'));"
            + "if(window.visualViewport){window.visualViewport.dispatchEvent(new Event('resize'));}"
            + "})()";
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        FrameLayout root = new FrameLayout(this);
        root.setLayoutParams(new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        webView.setOverScrollMode(View.OVER_SCROLL_IF_CONTENT_SCROLLS);
        applyViewportSettings(webView.getSettings());
        webView.setInitialScale(0);
        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl(PORTAL_URL);

        root.addView(webView);
        setContentView(root);
    }

    @Override
    public void onConfigurationChanged(@NonNull Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        notifyWebViewport();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) notifyWebViewport();
    }

    private void notifyWebViewport() {
        if (webView == null) return;
        applyViewportSettings(webView.getSettings());
        webView.setInitialScale(0);
        webView.requestLayout();
        webView.post(() -> webView.evaluateJavascript(RESIZE_SCRIPT, null));
    }

    private void applyViewportSettings(WebSettings settings) {
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NORMAL);
        float fontScale = getResources().getConfiguration().fontScale;
        settings.setTextZoom(Math.round(fontScale * 100));
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }
}
