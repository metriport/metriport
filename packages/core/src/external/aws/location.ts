import * as AWS from "aws-sdk";
import { PromiseResult } from "aws-sdk/lib/request";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
dayjs.extend(duration);

export type Coordinates = {
  lat: number;
  lon: number;
};

export type CoordinatesAndRelevance = {
  coordinates: Coordinates;
  relevance: number;
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

export function getCoordinatesAndRelevanceFromLocation(
  suggestedAddress: AWS.Location.SearchForTextResult
): CoordinatesAndRelevance {
  const point = suggestedAddress.Place?.Geometry?.Point;
  const relevance = suggestedAddress.Relevance;

  if (point) {
    const lon = point[0];
    const lat = point[1];
    if (lon && lat && relevance) {
      return {
        coordinates: {
          lon,
          lat,
        },
        relevance,
      };
    }
  }

  throw new Error("No location found");
}
