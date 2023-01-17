import { Activity } from "@metriport/api";
import dayjs from "dayjs";

import { AppleHealth, AppleHealthItem, hasActivity } from "../../mappings/apple";

export function mapDataToActivity(data: AppleHealth) {
  const activity: Activity[] = []

  if (hasActivity(data)) {
    data.HKQuantityTypeIdentifierActiveEnergyBurned?.forEach((appleItem) => {
      const dateIndex = findDateIndex(activity, appleItem);

      if (dateIndex >= 0) {
        activity[dateIndex] = {
          ...activity[dateIndex],
          summary: {
            ...activity[dateIndex].summary,
            energy_expenditure: {
              ...activity[dateIndex].summary?.energy_expenditure,
              active_kcal: appleItem.value
            }
          }
        }
        return;
      }

      activity.push({
        metadata: {
          date: dayjs(appleItem.date).format("YYYY-MM-DD"),
          source: 'apple',
        },
        summary: {
          energy_expenditure: {
            active_kcal: appleItem.value
          }
        },
      })
    })

    data.HKQuantityTypeIdentifierBasalEnergyBurned?.forEach((appleItem) => {
      const dateIndex = findDateIndex(activity, appleItem);

      if (dateIndex >= 0) {
        activity[dateIndex] = {
          ...activity[dateIndex],
          summary: {
            ...activity[dateIndex].summary,
            energy_expenditure: {
              ...activity[dateIndex].summary?.energy_expenditure,
              basal_metabolic_rate_kcal: appleItem.value
            }
          }
        }
        return;
      }

      activity.push({
        metadata: {
          date: dayjs(appleItem.date).format("YYYY-MM-DD"),
          source: 'apple',
        },
        summary: {
          energy_expenditure: {
            basal_metabolic_rate_kcal: appleItem.value
          }
        },
      })
    })

    data.HKQuantityTypeIdentifierStepCount?.forEach((appleItem) => {
      const dateIndex = findDateIndex(activity, appleItem);

      if (dateIndex >= 0) {
        // activity[dateIndex].summary!.movement?.steps_count = appleItem.value
        activity[dateIndex] = {
          ...activity[dateIndex],
          summary: {
            ...activity[dateIndex].summary,
            movement: {
              ...activity[dateIndex].summary?.movement,
              steps_count: appleItem.value
            }
          }
        }
        return;
      }

      activity.push({
        metadata: {
          date: dayjs(appleItem.date).format("YYYY-MM-DD"),
          source: 'apple',
        },
        summary: {
          movement: {
            steps_count: appleItem.value
          }
        },
      })
    })

    data.HKQuantityTypeIdentifierFlightsClimbed?.forEach((appleItem) => {
      const dateIndex = findDateIndex(activity, appleItem);

      if (dateIndex >= 0) {
        // activity[dateIndex].summary!.movement?.steps_count = appleItem.value
        activity[dateIndex] = {
          ...activity[dateIndex],
          summary: {
            ...activity[dateIndex].summary,
            movement: {
              ...activity[dateIndex].summary?.movement,
              floors_count: appleItem.value
            }
          }
        }
        return;
      }

      activity.push({
        metadata: {
          date: dayjs(appleItem.date).format("YYYY-MM-DD"),
          source: 'apple',
        },
        summary: {
          movement: {
            floors_count: appleItem.value
          }
        },
      })
    })
  }


  return activity
}

const findDateIndex = (arr: Activity[], appleItem: AppleHealthItem) => {
  return arr.findIndex(activity => dayjs(activity.metadata.date).format("YYYY-MM-DD") === dayjs(appleItem.date).format("YYYY-MM-DD"))
}