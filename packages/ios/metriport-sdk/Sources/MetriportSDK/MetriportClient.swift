import Foundation
import HealthKit
import Combine
import CoreData
import WebKit

class MyDailyData: ObservableObject {
    var dailyData: [Sample] = []

    public func addDay(date: Date, value: Int) {
        let day = Sample(date: date, value: value)
        self.dailyData.append(day)
    }
}

struct Sample: Codable {
    var date: Date
    var value: Int
}

public class MetriportClient {
    let healthStore: HKHealthStore
    let metriportApi: MetriportApi
    private let healthKitTypes = HealthKitTypes()
    private var thirtyDaySamples: [ String: [Sample] ] = [:]

    init (healthStore: HKHealthStore, clientApiKey: String, apiUrl: String?) {
        self.metriportApi = MetriportApi(clientApiKey: clientApiKey, apiUrl: apiUrl)
        self.healthStore = healthStore
    }

    public func checkBackgroundUpdates(metriportUserId: String, sampleTypes: [HKSampleType]) {
        enableBackgroundDelivery(for: sampleTypes)
        fetchDataForAllTypes(metriportUserId: metriportUserId)
//        sleepTime()
//        workouts()
    }

    // TODO: ALL IT GIVES ME IS IN BED RIGHT NOW (REM, DEEP AND LIGHT ARE A PART OF IOS 16 AND BEYOND)
//    func sleepTime() {
//        print("started")
//        let healthStore = HKHealthStore()
//        // startDate and endDate are NSDate objects
//        // first, we define the object type we want
//        if let sleepType = HKObjectType.categoryType(forIdentifier: HKCategoryTypeIdentifier.sleepAnalysis) {
//            // You may want to use a predicate to filter the data... startDate and endDate are NSDate objects corresponding to the time range that you want to retrieve
//            //let predicate = HKQuery.predicateForSamplesWithStartDate(startDate,endDate: endDate ,options: .None)
//            // Get the recent data first
//            let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
//            // the block completion to execute
//            let query = HKSampleQuery(sampleType: sleepType, predicate: nil, limit: 100000, sortDescriptors: [sortDescriptor]) { (query, tmpResult, error) -> Void in
//                if error != nil {
//                    print(error)
//                    // Handle the error in your app gracefully
//                    return
//                }
//                if let result = tmpResult {
//                    for item in result {
//                        if let sample = item as? HKCategorySample {
//                            let value = (sample.value == HKCategoryValueSleepAnalysis.inBed.rawValue) ? "InBed" : "Asleep"
//                            print("Healthkit sleep: \(sample.startDate) \(sample.endDate) - value: \(value)")
//                        }
//                    }
//                }
//            }
//
//            healthStore.execute(query)
//        }
//    }

    // TODO: AGGREGATE WORKOUT DATA
    // ITS A QUERY WITHIN A QUERY IF I WANT TO BE ABLE TO ACCESS HEART RATE, RESPITORY RATE ETC. DURING WORKOUT
//    func workouts() {
//        let calendar = Calendar.current
//        let endDate = Date()
//        let oneMonthAgo = DateComponents(month: -1)
//        guard let startDate = calendar.date(byAdding: oneMonthAgo, to: endDate) else {
//            fatalError("*** Unable to calculate the start date ***")
//        }
//
//        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
//
//        let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierEndDate,
//                                              ascending: true)
//
//        let query = HKSampleQuery(
//          sampleType: .workoutType(),
//          predicate: predicate,
//          limit: 20,
//          sortDescriptors: [sortDescriptor]) { (query, results, error) in
//              if let results = results {
//                  for result in results {
//                      if let workout = result as? HKWorkout {
//                          // Here's a HKWorkout object
//                          print(workout.startDate)
//                          print(workout.duration)
//                          print(workout.workoutActivityType.rawValue)
//                          print("")
//                      }
//                  }
//              }
//              else {
//                  // No results were returned, check the error
//              }
//          }
//
//        HKHealthStore().execute(query)
//    }

    // Enable all specified data types to send data in the background
    private func enableBackgroundDelivery(for sampleTypes: [HKSampleType]) {
      for sampleType in sampleTypes {
          healthStore.enableBackgroundDelivery(for: sampleType, frequency: .hourly) { (success, failure) in

          guard failure == nil && success else {
            return
          }
        }
      }
    }

    private func fetchDataForAllTypes(metriportUserId: String) {
        // There are 2 types of data aggregations
        let cumalativeTypes = self.healthKitTypes.cumalativeTypes
        let discreteTypes = self.healthKitTypes.discreteTypes

        // This allows us to await until all the queries for the last 30 days are done
        // So that in group.notifiy we make a request
        let group = DispatchGroup()
        
        // Aggregate data for a day
        let interval = DateComponents(day: 1)
        
        for sampleType in cumalativeTypes {
            group.enter()

           if UserDefaults.standard.object(forKey: "date \(sampleType)") == nil {
               fetchHistoricalData(type: sampleType, queryOption: .cumulativeSum, interval: interval, group: group)
           }
            
            fetchHourly(type: sampleType, queryOption: .cumulativeSum, metriportUserId: metriportUserId)
        }

        for sampleType in discreteTypes {
            group.enter()
            
            if UserDefaults.standard.object(forKey: "date \(sampleType)") == nil {
                fetchHistoricalData(type: sampleType, queryOption: .discreteAverage, interval: interval, group: group)
            }
            
            fetchHourly(type: sampleType, queryOption: .discreteAverage, metriportUserId: metriportUserId)
        }

        group.notify(queue: .main) {
            if self.thirtyDaySamples.count != 0 {
                self.metriportApi.sendData(metriportUserId: metriportUserId, samples: self.thirtyDaySamples)
            }
        }
    }

    // Retrieve daily values for the last 30 days for all types
    private func fetchHistoricalData(type: HKQuantityType, queryOption: HKStatisticsOptions, interval: DateComponents, group: DispatchGroup) {

        let query = createStatisticsQuery(interval: interval, quantityType: type, options: queryOption)

        query.initialResultsHandler = {
            query, results, error in

            // Set time for a month ago (last 30 days)
            let calendar = Calendar.current
            let endDate = Date()
            let oneMonthAgo = DateComponents(month: -1)
            guard let startDate = calendar.date(byAdding: oneMonthAgo, to: endDate) else {
                fatalError("*** Unable to calculate the start date ***")
            }

            // Each type has its own unit of measurement
            let unit = self.healthKitTypes.getUnit(quantityType: type)

            guard let data = self.handleStatistics(results: results,
                                                   unit: unit,
                                                   startDate: startDate,
                                                   endDate: endDate,
                                                   queryOption: queryOption) else {
                print("error with handleStatistics \(type)")
                return
            }

            // Get the last date and set it in local storage
            // This will be used as the starting point for hourly queries
            let lastDate = data.last?.date ?? Date()

            self.setLocalKeyValue(key: "date \(type)", val: lastDate)
            
            if data.count != 0 {
                self.thirtyDaySamples["\(type)"] = data
            }

            group.leave()
        }

        healthStore.execute(query)
    }

    private func fetchHourly(type: HKQuantityType, queryOption: HKStatisticsOptions, metriportUserId: String) {

        // Aggregate data for an hour
        let interval = DateComponents(hour: 1)

        let query = createStatisticsQuery(interval: interval, quantityType: type, options: queryOption)

        // We dont initially fetch data for the hours
        query.initialResultsHandler = {
            query, results, error in
        }

        // This listens for data that is added for the type
        query.statisticsUpdateHandler = {
            query, statistics, statisticsCollection, error in

            let calendar = Calendar.current
            var startDate = Date()
            let tomorrow = DateComponents(day: 1)

            // Get the last datetime specified after the 30 day fetch
            if let date = UserDefaults.standard.object(forKey: "date \(type)") as! Optional<Data> {
                do {
                    startDate = try NSKeyedUnarchiver.unarchiveTopLevelObjectWithData(date) as! Date
                } catch {
                    print("Couldnt read object")
                }
            }

            guard let endDate = calendar.date(byAdding: tomorrow, to: startDate) else {
                fatalError("*** Unable to calculate the start date ***")
            }

            // Each type has its own unit of measurement
            let unit = self.healthKitTypes.getUnit(quantityType: type)

            guard let data = self.handleStatistics(results: statisticsCollection,
                                                   unit: unit,
                                                   startDate: startDate,
                                                   endDate: endDate,
                                                   queryOption: queryOption) else {
                print("error with handleStatistics \(type)")
                return
            }

            self.metriportApi.sendData(metriportUserId: metriportUserId, samples: ["\(type)" : data])
        }

        healthStore.execute(query)
    }

    // This sets up the query to gather statitics
    private func createStatisticsQuery(interval: DateComponents, quantityType: Optional<HKQuantityType>, options: HKStatisticsOptions) -> HKStatisticsCollectionQuery {
        let calendar = Calendar.current


        let components = DateComponents(calendar: calendar,
                                        timeZone: calendar.timeZone,
                                        hour: 12,
                                        minute: 0,
                                        second: 0,
                                        weekday: 1)

        // This creates the anchor point to fetch data in intervals from
        // We are setting it to monnday at midnight above
        guard let anchorDate = calendar.nextDate(after: Date(),
                                                 matching: components,
                                                 matchingPolicy: .nextTime,
                                                 repeatedTimePolicy: .first,
                                                 direction: .backward) else {
            fatalError("*** unable to find the previous Monday. ***")
        }

        guard let statsQuantityType = quantityType else {
            fatalError("*** Unable to create a step count type ***")
        }

        // Create the query. It gathers the quantity type we would like to receive
        // It uses the anchor point to set the initial date and time
        // Then with the interval we set we will aggregate data within the timeframe
        let query = HKStatisticsCollectionQuery(quantityType: statsQuantityType,
                                                quantitySamplePredicate: nil,
                                                options: options,
                                                anchorDate: anchorDate,
                                                intervalComponents: interval)

        return query
    }

    // This handles the results of the query
    private func handleStatistics(results: Optional<HKStatisticsCollection>,
                                  unit: HKUnit,
                                  startDate: Date,
                                  endDate: Date,
                                  queryOption: HKStatisticsOptions
    ) -> [Sample]? {
        guard let statsCollection = results else {
            print("error with stats collection")
            return nil
        }

        let dailyData = self.getCollectionsData(statsCollection: statsCollection,
                                            startDate: startDate,
                                            endDate: endDate,
                                            unit: unit,
                                            queryOption: queryOption)

        return dailyData
    }

    // Grabs the results and picks out the data for specified days and then formats it
    private func getCollectionsData(statsCollection: HKStatisticsCollection,
                                    startDate: Date,
                                    endDate: Date,
                                    unit: HKUnit,
                                    queryOption: HKStatisticsOptions
    ) -> [Sample] {

        let dailyData = MyDailyData()

        statsCollection.enumerateStatistics(from: startDate, to: endDate)
        { (statistics, stop) in
            if let quantity = self.getSumOrAvgQuantity(statistics: statistics, queryOption: queryOption) {
                let date = statistics.startDate
                let value = quantity.doubleValue(for: unit)

                // Extract each day's data.
                dailyData.addDay(date: date, value: Int(value))
            }
        }

        return dailyData.dailyData
    }

    private func getSumOrAvgQuantity(statistics: HKStatistics, queryOption: HKStatisticsOptions) -> Optional<HKQuantity> {
        if queryOption == .cumulativeSum {
            return statistics.sumQuantity()
        }

        return statistics.averageQuantity()
    }

    private func setLocalKeyValue(key: String, val: Date) {
        do {
            let data : Data = try NSKeyedArchiver.archivedData(withRootObject: val as Any, requiringSecureCoding: false)
            UserDefaults.standard.set(data, forKey: key)
        } catch {
            print("Couldnt write files")
        }
    }
}

