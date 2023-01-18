//
//  ContentView.swift
//  Metriport mobile
//
//  Created by Jorge orta on 1/2/23.
//

import SwiftUI
import Metriport_IOS
import Foundation

struct WidgetView: View {
    // Controller to manage and manipulate webview state
    @ObservedObject var webviewController = WebviewController()
    
    // Initialize the Metriport healthkit package
    var healthStore = MetriportHealthStoreManager();
    
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


