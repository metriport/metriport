import * as AWS from "aws-sdk";
import { PromiseResult } from "aws-sdk/lib/request";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
dayjs.extend(duration);

export type Coordinates = {
  lat: number;
  lon: number;
};

export type GeocodingResult = {
  coordinates: Coordinates;
  relevance: number;
  suggestedLabel: string;
};

export function makeLocationClient(region: string): AWS.Location {
  return new AWS.Location({ signatureVersion: "v4", region });
}

export function getLocationResultPayload({
  result,
  failGracefully = false,
}: {
  result: PromiseResult<AWS.Location.SearchPlaceIndexForTextResponse, AWS.AWSError>;
  failGracefully?: boolean;
}) {
  if (!result.Results) {
    if (failGracefully) return undefined;
    throw new Error("Failed to get location coordinates");
  }
  return result.Results;
}

export function parseSuggestedAddress(
  suggestedAddress: AWS.Location.SearchForTextResult
): GeocodingResult {
  const point = suggestedAddress.Place?.Geometry?.Point;
  const relevance = suggestedAddress.Relevance;
  const label = suggestedAddress.Place.Label;
  const errorMsg = "No location found";

  if (!point) throw new Error(errorMsg);

  const lon = point[0];
  const lat = point[1];
  if (lon && lat && relevance && label) {
    return {
      coordinates: {
        lon,
        lat,
      },
      relevance,
      suggestedLabel: label,
    };
  }

  throw new Error(errorMsg);
}
