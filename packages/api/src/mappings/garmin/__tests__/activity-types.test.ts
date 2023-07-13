/* eslint-disable @typescript-eslint/no-empty-function */

import { activityTypeReadable } from "../activity-types";

describe("garmin activity types", () => {
  test("known activity type", async () => {
    expect(activityTypeReadable("RESORT_SKIING_SNOWBOARDING_WS")).toEqual(
      "Resort skiing/snowboarding"
    );
  });

  test("unknown activity type containing V4", async () => {
    expect(activityTypeReadable("HEADBANGING_AT_CONCERT_V4")).toEqual("Headbanging at concert");
  });

  test("unknown one-word activity type containing V2", async () => {
    expect(activityTypeReadable("SAILING_V2")).toEqual("Sailing");
  });

  test("unknown activity type containing WS", async () => {
    expect(activityTypeReadable("CALISTHENICS_WS")).toEqual("Calisthenics");
  });

  test("unknown activity type containing V* variations and WS", async () => {
    expect(activityTypeReadable("WRESTLE_WITH_BEAR_V90_WS")).toEqual("Wrestle with bear");
  });
});
