import { Activity } from "@metriport/api";
import { sum } from "lodash";

import { PROVIDER_GOOGLE } from "../../shared/constants";
import { GoogleActivity } from "./models/activity";
import { getValues, ValueKey } from ".";

const sourceIdCalories = "derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended";
const sourceIdSteps = "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps";

export const mapToActivity = (googleActivity: GoogleActivity, date: string): Activity => {
  const metadata = {
    date: date,
    source: PROVIDER_GOOGLE,
  };

  let activity: Activity = {
    metadata: metadata,
  };

  googleActivity.bucket[0].dataset.forEach((data) => {
    if (data.point.length) {
      const values = getValues(data.point);
      const intValues = getValues(data.point, ValueKey.intVal)

      if (data.dataSourceId === sourceIdCalories) {

        activity.summary = {
          ...activity.summary,
          energy_expenditure: {
            active_kcal: sum(values)
          }
        }
      }

      if (data.dataSourceId === sourceIdSteps) {

        activity.summary = {
          ...activity.summary,
          movement: {
            steps_count: sum(intValues)
          }
        }
      }
    }
  })

  return activity;
};