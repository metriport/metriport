import { Activity } from "@metriport/api-sdk";
import { PROVIDER_WHOOP } from "../../shared/constants";
import { WhoopWorkout } from "./models/workout";
import { ActivityLog } from "@metriport/api-sdk/devices/models/common/activity-log";
import { Util } from "../../shared/util";

export const mapToActivity = (whoopWorkouts: WhoopWorkout[], date: string): Activity => {
  const metadata = {
    date: date,
    source: PROVIDER_WHOOP,
  };
  const activity: Activity = {
    metadata: metadata,
  };

  const activityLogs: ActivityLog[] = [];
  for (const workout of whoopWorkouts) {
    let activityLog: ActivityLog = {
      metadata: metadata,
      start_time: workout.start,
      end_time: workout.end,
    };
    // this means that the sleep resp has the score
    if (workout.score_state === "SCORED") {
      if (!workout.score) throw new Error(`Missing workout.score`);
      const score = workout.score;
      activityLog = {
        ...activityLog,
        durations: {
          strain: {
            ...Util.addDataToObject("rest_seconds", score.zone_duration.zone_zero_milli),
            ...Util.addDataToObject("very_low_seconds", score.zone_duration.zone_one_milli),
            ...Util.addDataToObject("low_seconds", score.zone_duration.zone_two_milli),
            ...Util.addDataToObject("med_seconds", score.zone_duration.zone_three_milli),
            ...Util.addDataToObject("high_seconds", score.zone_duration.zone_four_milli),
            ...Util.addDataToObject("very_high_seconds", score.zone_duration.zone_five_milli),
          },
        },
        energy_expenditure: {
          active_kcal: Util.kilojoulesToKilocalories(score.kilojoule),
        },
        movement: {
          ...Util.addDataToObject("distance_meters", score.distance_meter),
          elevation: {
            ...Util.addDataToObject("gain_meters", score.altitude_gain_meter),
          },
        },
        biometrics: {
          heart_rate: {
            avg_bpm: score.average_heart_rate,
            max_bpm: score.max_heart_rate,
          },
        },
      };
    }
    activityLogs.push(activityLog);
  }
  return { ...activity, activity_logs: activityLogs };
};
