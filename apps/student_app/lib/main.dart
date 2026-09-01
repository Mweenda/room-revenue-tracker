import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

const Color _slate900 = Color(0xFF0F172A);
const String _portalUrl =
    'https://room-revenue-tracker.web.app/?app=student';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations(const [
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
  runApp(const StudentApp());
}

class StudentApp extends StatelessWidget {
  const StudentApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Room Revenue Student',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF059669),
          brightness: Brightness.dark,
        ),
        scaffoldBackgroundColor: _slate900,
        appBarTheme: const AppBarTheme(
          elevation: 0,
          scrolledUnderElevation: 0,
          shadowColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
          backgroundColor: _slate900,
        ),
      ),
      home: const StudentPortalShell(),
    );
  }
}

class StudentPortalShell extends StatefulWidget {
  const StudentPortalShell({super.key});

  @override
  State<StudentPortalShell> createState() => _StudentPortalShellState();
}

class _StudentPortalShellState extends State<StudentPortalShell>
    with WidgetsBindingObserver {
  late final WebViewController _controller;
  var _loading = true;
  Size? _lastSize;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(_slate900)
      ..enableZoom(false)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (mounted) setState(() => _loading = true);
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
            _notifyWebViewport();
          },
        ),
      )
      ..loadRequest(Uri.parse(_portalUrl));

    final platform = controller.platform;
    if (platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(false);
      platform.setMediaPlaybackRequiresUserGesture(false);
    }

    _controller = controller;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeMetrics() {
    _notifyWebViewport();
  }

  Future<void> _notifyWebViewport() async {
    try {
      await _controller.runJavaScript(
        "window.dispatchEvent(new Event('resize'));"
        "if (window.visualViewport) window.visualViewport.dispatchEvent(new Event('resize'));",
      );
    } catch (_) {
      // The page may not be ready yet; LayoutBuilder still sizes the WebView.
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _controller.canGoBack()) {
          await _controller.goBack();
          return;
        }
        SystemNavigator.pop();
      },
      child: Scaffold(
        backgroundColor: _slate900,
        resizeToAvoidBottomInset: true,
        body: LayoutBuilder(
          builder: (context, constraints) {
            final next = Size(constraints.maxWidth, constraints.maxHeight);
            if (_lastSize != next) {
              _lastSize = next;
              WidgetsBinding.instance.addPostFrameCallback((_) {
                _notifyWebViewport();
              });
            }
            return Stack(
              children: [
                SizedBox(
                  width: constraints.maxWidth,
                  height: constraints.maxHeight,
                  child: WebViewWidget(controller: _controller),
                ),
                if (_loading)
                  const Align(
                    alignment: Alignment.topCenter,
                    child: LinearProgressIndicator(
                      minHeight: 2,
                      color: Color(0xFF34D399),
                      backgroundColor: Colors.transparent,
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
