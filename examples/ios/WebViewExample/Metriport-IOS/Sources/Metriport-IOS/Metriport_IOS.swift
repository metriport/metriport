import SwiftUI
import WebKit

public struct MetriportWidget: UIViewRepresentable {
    
    var url: URL
    private var webView: WKWebView?
    
    public init(url: URL) {
        self.webView = WKWebView()
        self.url = url
    }
    
    public func makeUIView(context: Context) -> WKWebView {
        return webView!
    }

    public func updateUIView(_ webView: WKWebView, context: Context) {
       let request = URLRequest(url: url)
       webView.load(request)
    }
    
    public func goBack(){
        webView?.goBack()
    }

    public func goForward(){
        webView?.goForward()
    }
    
    public func refresh() {
        webView?.reload()
    }
}
