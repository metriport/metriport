import SwiftUI
import WebKit
import Combine

class WebViewModel : ObservableObject {
    // iOS to Javascript
    var callbackValueFromNative = PassthroughSubject<String, Never>()
}

protocol WebViewHandlerDelegate {
    func receivedJsonValueFromWebView(value: [String: Any?])
}

public struct MetriportWidget: UIViewRepresentable, WebViewHandlerDelegate {
    var healthStore: MetriportHealthStoreManager;
    private let healthKitTypes = HealthKitTypes()

    var url: String
    private var webView: WKWebView?
    
    public init(url: String, healthStore: MetriportHealthStoreManager) {
        let config = WKWebViewConfiguration()
        
        let webView = WKWebView(frame: .zero, configuration: config)
        
        self.webView = webView
        self.url = url
        self.healthStore = healthStore
    }
    
    // Received messages from webview
    public func receivedJsonValueFromWebView(value: [String : Any?]) {
        if let message = value["data"] as? String {
            if message == "connect" {
                healthStore.requestAuthorization(webView: self.webView)
            } else {
                do {
                    // Once all is complete the webview will receive the metriportuserid and send it to swift to use for webhook requests
                    let data : Data = try NSKeyedArchiver.archivedData(withRootObject: message, requiringSecureCoding: false)
                    UserDefaults.standard.set(data, forKey: "metriportUserId")
                    
                    // This will initially start fetching background data (last 30 days)
                    self.healthStore.metriportClient.checkBackgroundUpdates(metriportUserId: message, sampleTypes: self.healthKitTypes.typesToRead)
                } catch {
                    print("Couldnt write files")
                }
            }
        }
    }
    
    public func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    public func makeUIView(context: Context) -> WKWebView {
        webView?.configuration.userContentController.add(self.makeCoordinator(), name: "connect")
        webView?.navigationDelegate = context.coordinator
        webView?.allowsBackForwardNavigationGestures = false
        webView?.scrollView.isScrollEnabled = true
        
        return webView!
    }

    public func updateUIView(_ webView: WKWebView, context: Context) {
        let request = URLRequest(url: URL(string: "\(url)&apple=true")!)
        webView.load(request)
    }
    
    // These functions can be used to create custom buttons to navigate within webview
    public func goBack(){
        webView?.goBack()
    }

    public func goForward(){
        webView?.goForward()
    }

    public func refresh() {
        webView?.reload()
    }
    
    public class Coordinator : NSObject, WKNavigationDelegate {
        var parent: MetriportWidget
        var callbackValueFromNative: AnyCancellable? = nil
        var delegate: WebViewHandlerDelegate?
        
        deinit {
            callbackValueFromNative?.cancel()
        }
                
        init(_ uiWebView: MetriportWidget) {
            self.parent = uiWebView
            self.delegate = parent
        }
    }
}

// This handles the communication between widget and native code
extension MetriportWidget.Coordinator: WKScriptMessageHandler {
    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.receivedJsonValueFromWebView(value: ["data": message.body])
    }
}
