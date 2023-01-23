import SwiftUI
import MetriportSDK
import Foundation

struct WidgetView: View {
    // Controller to manage and manipulate webview state
    @ObservedObject var webviewController = WebviewController()
    
    // Initialize the Metriport healthkit package
    var healthStore = MetriportHealthStoreManager(clientApiKey: "eXV6N0FISEVTMGJ3azhKTVg2bFZBOmY1NjUwYWE0LWRkZWQtNDIwZi05YjM2LWVlMmRiZmNjZTNlYQ");
    
    var body: some View {
        VStack {
            Image(systemName: "globe")
                .imageScale(.large)
                .foregroundColor(.accentColor)
            Button {
                webviewController.getToken()
            } label: {
                Text("Metriport Widget")
            }
            .sheet(isPresented: $webviewController.showWebView) {
                // Custom widget to access all of the providers
                MetriportWidget(url: "\(webviewController.webUrl)/?token=\(webviewController.token)&colorMode=dark", healthStore: healthStore)
            }
        }
        .padding()
    }
}


