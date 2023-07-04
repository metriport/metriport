import Foundation
import SwiftUI

class WebviewController: ObservableObject {
    @Published var showWebView = false
    @Published var token: String = "token"
    @Published var webUrl: String = ""

    init() {
        if let apiUrl = ProcessInfo.processInfo.environment["WIDGET_URL"] {
            self.webUrl = apiUrl
        } else {
            print("WIDGET_URL not found")
        }
    }

    func openWebView() {
        self.showWebView = true
    }

    // Make a request to demo app server to then fetch token from Metriport api
    func getToken() {
        if let apiUrl = ProcessInfo.processInfo.environment["DEMO_API_URL"] {
            let headers = ["accept": "application/json", "x-api-key": ""]
            let url = URL(string: "\(apiUrl)/user/connect/token?userId=""")!

            var request = URLRequest(url: url)

            request.httpMethod = "GET"
            request.allHTTPHeaderFields = headers

            let session = URLSession.shared
            let dataTask = session.dataTask(with: request) { (data, response, error) -> Void in
              if (error != nil) {
                print(error as Any)
              } else {
                  guard let data = data else { return }
                  let token = String(data: data, encoding: .utf8)!

                  DispatchQueue.main.async {
                      print(token)
                      self.token = token
                      self.showWebView = true
                  }
              }
            }

            dataTask.resume()
        } else {
            print("DEMO_API_URL not found")
        }
    }
 }
