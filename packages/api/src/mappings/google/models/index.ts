import { z } from "zod";

// Not sure if we could replace 'any' by 'unknown' or an actual type. Disabling ESLint so we can deploy.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const googleResp = (googleActivityDataSourceId: any) => {
  return z.object({
    bucket: z.array(
      z.object({
        startTimeMillis: z.string(),
        endTimeMillis: z.string(),
        dataset: z.array(
          z.object({
            dataSourceId: googleActivityDataSourceId,
            point: googlePointArray,
          })
        ),
      })
    ),
  });
};

const googlePoint = z.object({
  startTimeNanos: z.string(),
  endTimeNanos: z.string(),
  dataTypeName: z.string(),
  originDataSourceId: z.string().nullish(),
  value: z.array(
    z.object({
      fpVal: z.number().optional(),
      intVal: z.number().optional(),
      mapVal: z.array(
        z.object({
          key: z.string(),
          value: z.object({ fpVal: z.number().optional() }),
        })
      ),
    })
  ),
});
export type SingleGooglePoint = z.infer<typeof googlePoint>;

const googlePointArray = z.array(googlePoint);
export type GooglePoint = z.infer<typeof googlePointArray>;

const sessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  startTimeMillis: z.string(),
  endTimeMillis: z.string(),
  modifiedTimeMillis: z.string().nullish(),
  application: z.object({
    packageName: z.string().nullish(),
    version: z.string().nullish(),
    detailsUrl: z.string().nullish(),
  }),
  activityType: z.number(),
});

export const sessionResp = z.object({
  session: z.array(sessionSchema),
  deletedSession: z.array(sessionSchema),
});

export type GoogleSessions = z.infer<typeof sessionResp>;
