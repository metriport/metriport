import { Config } from "../../util/config";
import axios from "axios";
import { z } from "zod";

const questPatientSchema = z.object({
  id: z.string(),
  cxId: z.string(),
  facilityIds: z.array(z.string()),
  data: z.object({
    firstName: z.string(),
    lastName: z.string(),
    dob: z.string(),
    genderAtBirth: z.string(),
    address: z.array(
      z.object({
        addressLine1: z.string(),
        addressLine2: z.string().optional(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
        country: z.string().optional(),
      })
    ),
  }),
});

const questRosterResponseSchema = z.object({
  patients: z.array(questPatientSchema),
  meta: z.object({
    itemsInTotal: z.number(),
    itemsOnPage: z.number(),
  }),
});

export async function generateQuestRoster() {
  const internalApi = axios.create({
    baseURL: Config.getApiUrl(),
  });
  const internalRoute = "/internal/quest/roster";

  const response = await internalApi.get(internalRoute);
  try {
    const rosterPage = questRosterResponseSchema.parse(response.data);
    console.log(rosterPage);
  } catch (error) {
    console.error(JSON.stringify(error, null, 2));
  }
}
