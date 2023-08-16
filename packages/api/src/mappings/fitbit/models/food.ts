import { z } from "zod";

// https://dev.fitbit.com/build/reference/web-api/nutrition/get-food-log/
export const fitbitFoodResp = z.object({
  foods: z.array(
    z.object({
      isFavorite: z.boolean(),
      logDate: z.string(),
      logId: z.number(),
      loggedFood: z.object({
        accessLevel: z.string(),
        amount: z.number(),
        brand: z.string().optional(),
        calories: z.number().optional(),
        foodId: z.number(),
        locale: z.string().optional(),
        mealTypeId: z.number(),
        name: z.string(),
        unit: z.object({
          id: z.number(),
          name: z.string(),
          plural: z.string(),
        }),
        units: z.array(z.number()),
      }),
      nutritionalValues: z
        .object({
          calories: z.number().optional(),
          carbs: z.number(),
          fat: z.number(),
          fiber: z.number(),
          protein: z.number(),
          sodium: z.number(),
        })
        .nullish(),
    })
  ),
  goals: z.object({ calories: z.number() }).optional(),
  summary: z.object({
    calories: z.number().optional(),
    carbs: z.number(),
    fat: z.number(),
    fiber: z.number(),
    protein: z.number(),
    sodium: z.number(),
    water: z.number(),
  }),
});

export type FitbitFood = z.infer<typeof fitbitFoodResp>;
