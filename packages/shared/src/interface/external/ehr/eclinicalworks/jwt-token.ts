import z from "zod";
import { EhrSources, clientSourceSuffix } from "../source";

export const eclinicalworksDashSource = EhrSources.eclinicalworks as const;
export const eclinicalworksDashJwtTokenDataSchema = z.object({
  practice_id: z.string(),
  source: z.literal(`${eclinicalworksDashSource}`),
});

export type EclinicalworksDashJwtTokenData = z.infer<typeof eclinicalworksDashJwtTokenDataSchema>;

// this stuff is "sent" when making the request
export const eclinicalworksClientSource =
  `${EhrSources.eclinicalworks}${clientSourceSuffix}` as const;
export const eclinicalworksClientJwtTokenDataSchema = z.object({
  iss: z.string().url(), // Authorization server URL
  //   aud: z.union([z.string().url(), z.array(z.string().url())]),
  aud: z.array(z.string().url()), //   "aud": ["growth-chart-app-123", "https://fhir4.eclinicalworks.com/fhir/r4/JAFJCD"][5]
  azp: z.string(), // Client ID
  sub: z.string(), // User identifier
  exp: z.number(), // Expiration timestamp
  iat: z.number(), // Issued at timestamp
  fhirUser: z.string().url(), // Practitioner resource URL
  code_challenge: z.string(),
  code_challenge_method: z.string(),
});

export type EclinicalworksClientJwtTokenData = z.infer<
  typeof eclinicalworksClientJwtTokenDataSchema
>;

// response schema
// Complete token response schema
export const eclinicalworksClientJwtTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("Bearer"),
  expires_in: z.number(),
  scope: z.string(),
  id_token: z.string().optional(),
  refresh_token: z.string().optional(),
  need_patient_banner: z.literal("false"),
  smart_style_url: z.string().url(),
});
