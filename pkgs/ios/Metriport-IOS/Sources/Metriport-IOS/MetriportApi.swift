import Foundation
import HealthKit
import Combine
import CoreData
import WebKit

class MetriportApi {
    // Encode the data and strigify payload to be able to send as JSON
    // Data is structured as [ "TYPE ie HeartRate": [ARRAY OF SAMPLES]]
    public func sendData(metriportUserId: String, samples: [ String: [Sample] ]) {
        var stringifyPayload: String = ""
        
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(samples)
            
            stringifyPayload = String(data: data, encoding: .utf8)!
        } catch {
            print("Couldnt write files")
        }
        
        makeRequest(metriportUserId: metriportUserId, payload: stringifyPayload)
    }
    
    // Send data to the api
    private func makeRequest(metriportUserId: String, payload: String) {
        
        let bodyData = try? JSONSerialization.data(
            withJSONObject: ["metriportUserId": metriportUserId, "data": payload]
        )
        
        if let apiUrl = ProcessInfo.processInfo.environment["OSS_API_URL"] {
            var request = URLRequest(url: URL(string: "\(apiUrl)/webhook/apple")!)
            request.httpMethod = "POST"
            request.httpBody = bodyData
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            if let clientApiKey = ProcessInfo.processInfo.environment["CLIENT_API_KEY"] {
                request.addValue(clientApiKey, forHTTPHeaderField: "x-api-key")
            }

            let task = URLSession.shared.dataTask(with: request) { data, response, error in
                guard let response = response as? HTTPURLResponse,
                    error == nil
                else {
                    print("error", error ?? URLError(.badServerResponse))
                    return
                }

                guard (200 ... 299) ~= response.statusCode else {
                    print("statusCode should be 2xx, but is \(response.statusCode)")
                    print("response = \(response)")
                    return
                }
            }

            task.resume()
        } else {
            print("OSS_API_URL not found")
        }
    }
}
