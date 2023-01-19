import Foundation
import HealthKit
import Combine
import CoreData
import WebKit

class MetriportApi {
    let apiUrl: String
    let clientApiKey: String

    init(clientApiKey: String, apiUrl: String?) {
        self.apiUrl = apiUrl ?? "https://api.metriport.com"
        self.clientApiKey = clientApiKey
    }

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

        var request = URLRequest(url: URL(string: "\(self.apiUrl)/webhook/apple")!)
        request.httpMethod = "POST"
        request.httpBody = bodyData
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addValue(self.clientApiKey, forHTTPHeaderField: "x-api-key")

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
    }
}
