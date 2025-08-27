import { z } from "zod";

const BENCHMARK_NAME = ["Public_AR_Current", "Public_AR_ACS2024", "Public_AR_Census2020"] as const;
type BenchmarkName = (typeof BENCHMARK_NAME)[number];

export interface CensusGeocoderParams {
  benchmark?: BenchmarkName;
}

// The standard address components returned by the US Census Geocoder, or an empty string if not applicable.
export const addressComponentsSchema = z.object({
  zip: z.string(),
  streetName: z.string(),
  preType: z.string(),
  city: z.string(),
  preDirection: z.string(),
  suffixDirection: z.string(),
  fromAddress: z.string(),
  state: z.string(),
  suffixType: z.string(),
  toAddress: z.string(),
  suffixQualifier: z.string(),
  preQualifier: z.string(),
});

// A geocoder response may contain multiple address matches for a given query.
export const addressMatchSchema = z.object({
  tigerLine: z.object({
    side: z.string(),
    tigerLineId: z.string(),
  }),
  coordinates: z.object({
    x: z.number(),
    y: z.number(),
  }),
  addressComponents: addressComponentsSchema,
  matchedAddress: z.string(),
});

// The response shape from the US Census Geocoder.
// https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html
export const censusGeocoderResponseSchema = z.object({
  result: z.object({
    input: z.object({
      address: z.object({
        zip: z.string(),
        street: z.string(),
        city: z.string(),
        state: z.string(),
      }),
    }),
    addressMatches: z.array(addressMatchSchema),
  }),
});

export type CensusGeocoderResponse = z.infer<typeof censusGeocoderResponseSchema>;
export type AddressMatch = z.infer<typeof addressMatchSchema>;
