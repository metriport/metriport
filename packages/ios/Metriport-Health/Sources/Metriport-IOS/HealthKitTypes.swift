import Foundation
import HealthKit

struct HealthKitTypes {
    let readableTypes: Set<HKSampleType> = [
        HKQuantityType.quantityType(forIdentifier: HKQuantityTypeIdentifier.distanceWalkingRunning)!,
        HKWorkoutType.workoutType(),
        HKQuantityType.quantityType(forIdentifier: HKQuantityTypeIdentifier.stepCount)!,
        HKQuantityType.quantityType(forIdentifier: HKQuantityTypeIdentifier.activeEnergyBurned)!,
        HKQuantityType.quantityType(forIdentifier: HKQuantityTypeIdentifier.heartRate)!,
        HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!,
    ]

    var typesToRead: [HKSampleType] = [
        HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!,
        HKObjectType.workoutType()
    ]
    
    var cumalativeTypes: [HKQuantityType] = [
        // ACTIVITY
        HKObjectType.quantityType(forIdentifier: .stepCount)!,
        HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
        HKObjectType.quantityType(forIdentifier: .basalEnergyBurned)!,
        HKObjectType.quantityType(forIdentifier: .flightsClimbed)!,

        // NUTRITION
        HKObjectType.quantityType(forIdentifier: .dietaryCaffeine)!,
        HKObjectType.quantityType(forIdentifier: .dietaryCalcium)!,
        HKObjectType.quantityType(forIdentifier: .dietaryCarbohydrates)!,
        HKObjectType.quantityType(forIdentifier: .dietaryCholesterol)!,
        HKObjectType.quantityType(forIdentifier: .dietaryCopper)!,
        HKObjectType.quantityType(forIdentifier: .dietaryEnergyConsumed)!,
        HKObjectType.quantityType(forIdentifier: .dietaryFatTotal)!,
        HKObjectType.quantityType(forIdentifier: .dietaryFiber)!,
        HKObjectType.quantityType(forIdentifier: .dietaryFolate)!,
        HKObjectType.quantityType(forIdentifier: .dietaryIodine)!,
        HKObjectType.quantityType(forIdentifier: .dietaryMagnesium)!,
        HKObjectType.quantityType(forIdentifier: .dietaryManganese)!,
        HKObjectType.quantityType(forIdentifier: .dietaryNiacin)!,
        HKObjectType.quantityType(forIdentifier: .dietaryPantothenicAcid)!,
        HKObjectType.quantityType(forIdentifier: .dietaryPhosphorus)!,
        HKObjectType.quantityType(forIdentifier: .dietaryPotassium)!,
        HKObjectType.quantityType(forIdentifier: .dietaryProtein)!,
        HKObjectType.quantityType(forIdentifier: .dietaryRiboflavin)!,
        HKObjectType.quantityType(forIdentifier: .dietarySelenium)!,
        HKObjectType.quantityType(forIdentifier: .dietarySodium)!,
        HKObjectType.quantityType(forIdentifier: .dietarySugar)!,
        HKObjectType.quantityType(forIdentifier: .dietaryThiamin)!,
        HKObjectType.quantityType(forIdentifier: .dietaryVitaminA)!,
        HKObjectType.quantityType(forIdentifier: .dietaryVitaminB6)!,
        HKObjectType.quantityType(forIdentifier: .dietaryVitaminB12)!,
        HKObjectType.quantityType(forIdentifier: .dietaryVitaminC)!,
        HKObjectType.quantityType(forIdentifier: .dietaryVitaminD)!,
        HKObjectType.quantityType(forIdentifier: .dietaryVitaminE)!,
        HKObjectType.quantityType(forIdentifier: .dietaryVitaminK)!,
        HKObjectType.quantityType(forIdentifier: .dietaryWater)!,
        HKObjectType.quantityType(forIdentifier: .dietaryZinc)!,
    ]

    
    var discreteTypes: [HKQuantityType] = [
        // BODY
        HKObjectType.quantityType(forIdentifier: .height)!,
        HKObjectType.quantityType(forIdentifier: .leanBodyMass)!,
        HKObjectType.quantityType(forIdentifier: .bodyMass)!,
        HKObjectType.quantityType(forIdentifier: .bodyFatPercentage)!,
        
        // VITALS
        HKObjectType.quantityType(forIdentifier: .heartRate)!,
        HKObjectType.quantityType(forIdentifier: .restingHeartRate)!,
        HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!,
        HKObjectType.quantityType(forIdentifier: .bodyTemperature)!,
        HKObjectType.quantityType(forIdentifier: .bloodPressureSystolic)!,
        HKObjectType.quantityType(forIdentifier: .bloodPressureDiastolic)!,
        HKObjectType.quantityType(forIdentifier: .respiratoryRate)!,
        HKSampleType.quantityType(forIdentifier: .vo2Max)!
    ]
    
    init() {
        self.typesToRead = self.typesToRead + self.cumalativeTypes + self.discreteTypes
    }
    
    public func getUnit(quantityType: HKQuantityType) -> HKUnit {
        switch quantityType {
            // ACTIVITY
        case
            HKSampleType.quantityType(forIdentifier: .stepCount)!,
            HKSampleType.quantityType(forIdentifier: .flightsClimbed)!:
            return .count()
            
        case
            HKSampleType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKSampleType.quantityType(forIdentifier: .basalEnergyBurned)!:
            return .kilocalorie()
            
        case HKSampleType.quantityType(forIdentifier: .vo2Max)!:
            return .literUnit(with: .milli).unitDivided(by: .gramUnit(with: .kilo).unitMultiplied(by: .minute()))
            
            // BODY
        case HKQuantityType.quantityType(forIdentifier: .bodyFatPercentage)!:
            return .percent()
            
        case HKQuantityType.quantityType(forIdentifier: .height)!:
            return .meterUnit(with: .centi)
            
        case HKObjectType.quantityType(forIdentifier: .leanBodyMass)!,
            HKObjectType.quantityType(forIdentifier: .bodyMass)!:
            return .gramUnit(with: .kilo)
            
            // VITALS
        case
            HKSampleType.quantityType(forIdentifier: .heartRate)!,
            HKSampleType.quantityType(forIdentifier: .respiratoryRate)!,
            HKSampleType.quantityType(forIdentifier: .restingHeartRate)!:
            return .count().unitDivided(by: .minute())
            
        case HKSampleType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!:
            return .secondUnit(with: .milli)
            
        case
            HKSampleType.quantityType(forIdentifier: .bloodPressureSystolic)!,
            HKSampleType.quantityType(forIdentifier: .bloodPressureDiastolic)!:
            return .millimeterOfMercury()
            
        case HKObjectType.quantityType(forIdentifier: .bodyTemperature)!:
            return .degreeCelsius()
            
            
            // NUTRITION
        case
            HKObjectType.quantityType(forIdentifier: .dietaryCarbohydrates)!,
            HKObjectType.quantityType(forIdentifier: .dietaryFatTotal)!,
            HKObjectType.quantityType(forIdentifier: .dietaryFiber)!,
            HKObjectType.quantityType(forIdentifier: .dietaryProtein)!,
            HKObjectType.quantityType(forIdentifier: .dietarySodium)!,
            HKObjectType.quantityType(forIdentifier: .dietarySugar)!:
            return .gramUnit(with: .none)
            
        case
            HKObjectType.quantityType(forIdentifier: .dietaryCaffeine)!,
            HKObjectType.quantityType(forIdentifier: .dietaryCalcium)!,
            HKObjectType.quantityType(forIdentifier: .dietaryCholesterol)!,
            HKObjectType.quantityType(forIdentifier: .dietaryCopper)!,
            HKObjectType.quantityType(forIdentifier: .dietaryEnergyConsumed)!,
            HKObjectType.quantityType(forIdentifier: .dietaryFolate)!,
            HKObjectType.quantityType(forIdentifier: .dietaryIodine)!,
            HKObjectType.quantityType(forIdentifier: .dietaryMagnesium)!,
            HKObjectType.quantityType(forIdentifier: .dietaryManganese)!,
            HKObjectType.quantityType(forIdentifier: .dietaryNiacin)!,
            HKObjectType.quantityType(forIdentifier: .dietaryPantothenicAcid)!,
            HKObjectType.quantityType(forIdentifier: .dietaryPhosphorus)!,
            HKObjectType.quantityType(forIdentifier: .dietaryPotassium)!,
            HKObjectType.quantityType(forIdentifier: .dietaryRiboflavin)!,
            HKObjectType.quantityType(forIdentifier: .dietarySelenium)!,
            HKObjectType.quantityType(forIdentifier: .dietaryThiamin)!,
            HKObjectType.quantityType(forIdentifier: .dietaryVitaminA)!,
            HKObjectType.quantityType(forIdentifier: .dietaryVitaminB6)!,
            HKObjectType.quantityType(forIdentifier: .dietaryVitaminB12)!,
            HKObjectType.quantityType(forIdentifier: .dietaryVitaminC)!,
            HKObjectType.quantityType(forIdentifier: .dietaryVitaminD)!,
            HKObjectType.quantityType(forIdentifier: .dietaryVitaminE)!,
            HKObjectType.quantityType(forIdentifier: .dietaryVitaminK)!,
            HKObjectType.quantityType(forIdentifier: .dietaryZinc)!:
            return .gramUnit(with: .milli)
            
        case HKObjectType.quantityType(forIdentifier: .dietaryWater)!:
            return .literUnit(with: .milli)
            
            
        default:
            fatalError("\(String(describing: self)) type not supported)")
        }
    }
}
