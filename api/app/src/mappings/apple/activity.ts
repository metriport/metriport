import { Activity } from "@metriport/api";
import { ActivityLog } from "@metriport/api/lib/devices/models/common/activity-log";
import dayjs from "dayjs";

import { AppleHealth, createMetadata } from ".";
import { ISO_DATE } from "../../shared/date";
import { activityTypeMapping } from "./activity-types";

export function mapDataToActivity(data: AppleHealth) {
  const activity: Activity[] = [];
  const dateToIndex: { [key: string]: number } = {};

  data.HKQuantityTypeIdentifierActiveEnergyBurned?.forEach(appleItem => {
    const date = dayjs(appleItem.date).format(ISO_DATE);
    const index = dateToIndex[date];

    if (index || index === 0) {
      activity[index] = {
        ...activity[index],
        summary: {
          ...activity[index].summary,
          energy_expenditure: {
            ...activity[index].summary?.energy_expenditure,
            active_kcal: appleItem.value,
          },
        },
      };
      return;
    }

    dateToIndex[date] = activity.length;

    activity.push({
      metadata: createMetadata(date),
      summary: {
        energy_expenditure: {
          active_kcal: appleItem.value,
        },
      },
    });
  });

  data.HKQuantityTypeIdentifierBasalEnergyBurned?.forEach(appleItem => {
    const date = dayjs(appleItem.date).format(ISO_DATE);
    const index = dateToIndex[date];

    if (index || index === 0) {
      activity[index] = {
        ...activity[index],
        summary: {
          ...activity[index].summary,
          energy_expenditure: {
            ...activity[index].summary?.energy_expenditure,
            basal_metabolic_rate_kcal: appleItem.value,
          },
        },
      };
      return;
    }

    dateToIndex[date] = activity.length;

    activity.push({
      metadata: createMetadata(date),
      summary: {
        energy_expenditure: {
          basal_metabolic_rate_kcal: appleItem.value,
        },
      },
    });
  });

  data.HKQuantityTypeIdentifierStepCount?.forEach(appleItem => {
    const date = dayjs(appleItem.date).format(ISO_DATE);
    const index = dateToIndex[date];

    if (index || index === 0) {
      activity[index] = {
        ...activity[index],
        summary: {
          ...activity[index].summary,
          movement: {
            ...activity[index].summary?.movement,
            steps_count: appleItem.value,
          },
        },
      };
      return;
    }

    dateToIndex[date] = activity.length;

    activity.push({
      metadata: createMetadata(date),
      summary: {
        movement: {
          steps_count: appleItem.value,
        },
      },
    });
  });

  data.HKQuantityTypeIdentifierFlightsClimbed?.forEach(appleItem => {
    const date = dayjs(appleItem.date).format(ISO_DATE);
    const index = dateToIndex[date];

    if (index || index === 0) {
      activity[index] = {
        ...activity[index],
        summary: {
          ...activity[index].summary,
          movement: {
            ...activity[index].summary?.movement,
            floors_count: appleItem.value,
          },
        },
      };
      return;
    }

    dateToIndex[date] = activity.length;

    activity.push({
      metadata: createMetadata(date),
      summary: {
        movement: {
          floors_count: appleItem.value,
        },
      },
    });
  });

  data.HKWorkout?.forEach(workoutItem => {
    const date = dayjs(workoutItem.startTime).format(ISO_DATE);
    const index = dateToIndex[date];

    const payload: ActivityLog = {
      metadata: createMetadata(date),
      name: activityTypeMapping[workoutItem.type],
      start_time: workoutItem.startTime,
      end_time: workoutItem.endTime,
    };

    if (workoutItem.distance) {
      payload.movement = {
        distance_meters: workoutItem.distance,
      };
    }

    if (workoutItem.duration) {
      payload.durations = {
        active_seconds: workoutItem.duration,
      };
    }

    if (workoutItem.kcal) {
      payload.energy_expenditure = {
        active_kcal: workoutItem.kcal,
      };
    }

    if (index || index === 0) {
      activity[index] = {
        ...activity[index],
        activity_logs: [...(activity[index].activity_logs ?? []), payload],
      };
      return;
    }

    dateToIndex[date] = activity.length;

    activity.push({
      metadata: createMetadata(date),
      activity_logs: [payload],
    });
  });

  return activity;
}
