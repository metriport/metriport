import Foundation
import HealthKit
import Combine
import CoreData
import WebKit

public class MetriportHealthStoreManager {
    public let healthStore = HKHealthStore()
    public let metriportClient: MetriportClient
    private let healthKitTypes = HealthKitTypes()
    private var metriportUserId = ""

    public init(clientApiKey: String, apiUrl: String? = nil) {
        self.metriportClient = MetriportClient(healthStore: healthStore, clientApiKey: clientApiKey, apiUrl: apiUrl)

        
        // If we've already authorized then start checking background updates on app load
        if UserDefaults.standard.object(forKey: "HealthKitAuth") != nil {
            
            // Get metriportUserId from local storage to send in webhook requests
            if let userid = UserDefaults.standard.object(forKey: "metriportUserId") as! Optional<Data> {
                do {
                    self.metriportUserId = try NSKeyedUnarchiver.unarchiveTopLevelObjectWithData(userid) as! String
                } catch {
                    print("Couldnt read object")
                }
            }
            
            self.metriportClient.checkBackgroundUpdates(metriportUserId: self.metriportUserId, sampleTypes: self.healthKitTypes.typesToRead)
        }
    }
    
    // Request authorization from user for the healthkit access
    public func requestAuthorization(webView: WKWebView?) {
        
        // Request authorization for those quantity types.
        healthStore.requestAuthorization(toShare: [], read: Set(self.healthKitTypes.typesToRead)) { (success, error) in
            // Handle error.
            if error != nil {
                let js = "var event = new CustomEvent('authorization', { detail: { success: false }}); window.dispatchEvent(event);"
                self.sendMessageToWebView(js: js, webView: webView)
            }
            
            if success {
                // On success dispatch message back to the webview that it's connected
                let js = "var event = new CustomEvent('authorization', { detail: { success: true }}); window.dispatchEvent(event);"
                self.sendMessageToWebView(js: js, webView: webView)
                
                // Set authorization to true in localstorage
                do {
                    let data : Data = try NSKeyedArchiver.archivedData(withRootObject: true, requiringSecureCoding: false)
                    UserDefaults.standard.set(data, forKey: "HealthKitAuth")
                } catch {
                    print("Couldnt write files")
                }
            }
        }
    }
    
    // Handles messages send to webview
    private func sendMessageToWebView(js: String, webView: WKWebView?) {
        DispatchQueue.main.async {
            webView?.evaluateJavaScript(js, completionHandler: { (response, error) in
                if let error = error {
                    print(error)
                } else {
                    print("Successfully sent message to webview")
                }
            })
        }
    }
}
