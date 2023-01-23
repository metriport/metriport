import { z } from "zod"


export const googleResp = (googleActivityDataSourceId: any) => {
  return z.object({
    bucket: z.array(
      z.object({
        startTimeMillis: z.string(),
        endTimeMillis: z.string(),
        dataset: z.array(
          z.object({
            dataSourceId: googleActivityDataSourceId,
            point: googlePoint
          })
        )
      })
    )
  })
}

export const googlePoint =
  z.array(
    z.object({
      startTimeNanos: z.string(),
      endTimeNanos: z.string(),
      dataTypeName: z.string(),
      originDataSourceId: z.string(),
      value: z.array(
        z.object({
          fpVal: z.number().optional(),
          intVal: z.number().optional(),
          mapVal: z.array(z.object({
            key: z.string(),
            value: z.object({ fpVal: z.number().optional() })
          }))
        })
      )
    })
  )

export type GooglePoint = z.infer<typeof googlePoint>;

