package com.roomrevenue.student;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    public static final String PORTAL_HOST = "room-revenue-tracker.web.app";
    public static final String PORTAL_PATH = "/student";
    public static final String PORTAL_URL = "https://" + PORTAL_HOST + PORTAL_PATH;
    public static final String SHELL_UA_TOKEN = "RoomRevenueStudent/1.1.3";
    private static final String RESIZE_SCRIPT =
        "(function(){window.dispatchEvent(new Event('resize'));"
            + "if(window.visualViewport){window.visualViewport.dispatchEvent(new Event('resize'));}"
            + "})()";
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private ActivityResultLauncher<Intent> fileChooserLauncher;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        fileChooserLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                Uri[] uris = WebChromeClient.FileChooserParams.parseResult(
                    result.getResultCode(),
                    result.getResultCode() == Activity.RESULT_OK ? result.getData() : null
                );
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(uris);
                    filePathCallback = null;
                }
            }
        );

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
        webView.setWebViewClient(new WebViewClient() {
            private boolean historyPinned;

            @Override
            public boolean shouldOverrideUrlLoading(@NonNull WebView view, @NonNull WebResourceRequest request) {
                String rewritten = ensureStudentPortalUrl(request.getUrl());
                if (rewritten != null) {
                    view.loadUrl(rewritten);
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (!historyPinned && url != null && url.contains(PORTAL_PATH)) {
                    view.clearHistory();
                    historyPinned = true;
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                WebView view,
                ValueCallback<Uri[]> callback,
                FileChooserParams params
            ) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                try {
                    fileChooserLauncher.launch(params.createIntent());
                    return true;
                } catch (Exception ignored) {
                    filePathCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
            }
        });
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

    static String ensureStudentPortalUrl(Uri uri) {
        if (uri == null) return null;
        String host = uri.getHost();
        if (host == null) return null;
        if (!host.equals(PORTAL_HOST) && !host.equals("room-revenue-tracker.firebaseapp.com")) {
            return null;
        }
        String path = uri.getPath();
        if (path == null || path.isEmpty() || path.equals("/") || path.equals("/index.html")) {
            return uri.buildUpon().encodedPath(PORTAL_PATH).build().toString();
        }
        return null;
    }

    private void applyViewportSettings(WebSettings settings) {
        settings.setJavaScriptEnabled(true);
        String ua = settings.getUserAgentString();
        if (ua == null || !ua.contains("RoomRevenueStudent")) {
            settings.setUserAgentString((ua == null ? "" : ua) + " " + SHELL_UA_TOKEN);
        }
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
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
