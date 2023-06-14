import SwiftUI
import MetriportSDK
import Foundation

struct WidgetView: View {
    // Controller to manage and manipulate webview state
    @ObservedObject var webviewController = WebviewController()
    
    // Initialize the Metriport healthkit package
    var healthStore = MetriportHealthStoreManager(
        clientApiKey: "ck9kMkJzWU5qSS1nQ0wtVzVTenFTOjIxZmE0MzJlLTcyM2ItNGExZC1hM2IyLWJkOWNkNzVhMDcxNw",
        sandbox: false,
        apiUrl: "https://be9518f61823.ngrok.app"
    );
    
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
                MetriportWidget(
                    healthStore: healthStore,
                    token: "nACWvytLD_q40pftLfku8",
                    sandbox: false,
                    url: "http://192.168.0.135:3001"
                )
            }
        }
        .padding()
    }
}


