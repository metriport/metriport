//
//  Metriport_mobileApp.swift
//  Metriport mobile
//
//  Created by Jorge orta on 1/2/23.
//

import SwiftUI
import Foundation
import WebKit

@main
struct Metriport_mobileApp: App {
    // Return the scene.
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    @State private var showWebView = false
    
    // var localWebView = MetriportWidget(url: URL(string: "http://localhost:3001/?token={YOUR_TOKEN}")!)

    // For more information of how to create a token view link below
    // https://docs.metriport.com/getting-started/connect-quickstart#4-link-to-the-metriport-connect-widget-in-your-app
    var webView = MetriportWidget(url: URL(string: "https://connect.metriport.com/?token=demo")!)
    
    var body: some View {
        VStack {
          webView
          HStack {
            Button(action: {
              self.webView.goBack()
            }){
              Image(systemName: "arrowtriangle.left.fill")
                                .font(.title)
                                .foregroundColor(.blue)
                                .padding()
            }
            Spacer()
            Button(action: {
              self.webView.refresh()
            }){
              Image(systemName: "arrow.clockwise.circle.fill")
                    .font(.title)
                    .foregroundColor(.blue)
                    .padding()
            }
            Spacer()
            Button(action: {
              self.webView.goForward()
            }){
              Image(systemName: "arrowtriangle.right.fill")
                    .font(.title)
                    .foregroundColor(.blue)
                    .padding()
            }
          }
        }
      }
}

struct MetriportWidget: UIViewRepresentable {
    
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
