import { z } from "zod"

export const googleBodyResp =
  z.object({
    bucket: z.array(
      z.object({
        startTimeMillis: z.string(),
        endTimeMillis: z.string(),
        dataset: z.array(
          z.object({
            dataSourceId: z.string(),
            point: z.array(
              z.object({
                startTimeNanos: z.string(),
                endTimeNanos: z.string(),
                dataTypeName: z.string(),
                originDataSourceId: z.string(),
                value: z.array(
                  z.object({ fpVal: z.number(), mapVal: z.array(z.unknown()) })
                )
              })
            )
          })
        )
      })
    )
  })



export type GoogleBody = z.infer<typeof googleBodyResp>;

