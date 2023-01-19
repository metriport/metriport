import { Activity } from "@metriport/api";
import dayjs from "dayjs";

import { AppleHealth, createMetadata } from "../../mappings/apple";
import { ISO_DATE } from "../../shared/date";

export function mapDataToActivity(data: AppleHealth) {
  const activity: Activity[] = []
  const dateToIndex: { [key: string]: number } = {}

  data.HKQuantityTypeIdentifierActiveEnergyBurned?.forEach((appleItem) => {
    const date = dayjs(appleItem.date).format(ISO_DATE);
    const index = dateToIndex[date];

    if (index || index === 0) {
      activity[index] = {
        ...activity[index],
        summary: {
          ...activity[index].summary,
          energy_expenditure: {
            ...activity[index].summary?.energy_expenditure,
            active_kcal: appleItem.value
          }
        }
      }
      return;
    }

    dateToIndex[date] = activity.length;

    activity.push({
      metadata: createMetadata(date),
      summary: {
        energy_expenditure: {
          active_kcal: appleItem.value
        }
      },
    })
  })

  data.HKQuantityTypeIdentifierBasalEnergyBurned?.forEach((appleItem) => {
    const date = dayjs(appleItem.date).format(ISO_DATE);
    const index = dateToIndex[date];

    if (index || index === 0) {
      activity[index] = {
        ...activity[index],
        summary: {
          ...activity[index].summary,
          energy_expenditure: {
            ...activity[index].summary?.energy_expenditure,
            basal_metabolic_rate_kcal: appleItem.value
          }
        }
      }
      return;
    }

    dateToIndex[date] = activity.length;

    activity.push({
      metadata: createMetadata(date),
      summary: {
        energy_expenditure: {
          basal_metabolic_rate_kcal: appleItem.value
        }
      },
    })
  })

  data.HKQuantityTypeIdentifierStepCount?.forEach((appleItem) => {
    const date = dayjs(appleItem.date).format(ISO_DATE);
    const index = dateToIndex[date];

    if (index || index === 0) {
      activity[index] = {
        ...activity[index],
        summary: {
          ...activity[index].summary,
          movement: {
            ...activity[index].summary?.movement,
            steps_count: appleItem.value
          }
        }
      }
      return;
    }

    dateToIndex[date] = activity.length;

    activity.push({
      metadata: createMetadata(date),
      summary: {
        movement: {
          steps_count: appleItem.value
        }
      },
    })
  })

  data.HKQuantityTypeIdentifierFlightsClimbed?.forEach((appleItem) => {
    const date = dayjs(appleItem.date).format(ISO_DATE);
    const index = dateToIndex[date];

    if (index || index === 0) {
      activity[index] = {
        ...activity[index],
        summary: {
          ...activity[index].summary,
          movement: {
            ...activity[index].summary?.movement,
            floors_count: appleItem.value
          }
        }
      }
      return;
    }

    dateToIndex[date] = activity.length;

    activity.push({
      metadata: createMetadata(date),
      summary: {
        movement: {
          floors_count: appleItem.value
        }
      },
    })
  })


  return activity
}