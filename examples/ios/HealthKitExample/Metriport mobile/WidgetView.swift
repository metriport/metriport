import SwiftUI
import MetriportSDK
import Foundation

struct WidgetView: View {
    // Controller to manage and manipulate webview state
    @ObservedObject var webviewController = WebviewController()

    // Initialize the Metriport healthkit package
    var healthStore = MetriportHealthStoreManager(clientApiKey: "", sandbox: false, apiUrl: "");

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
                MetriportWidget(healthStore: healthStore, token: webviewController.token, sandbox: false, url: "")
            }
        }
        .padding()
    }
}
