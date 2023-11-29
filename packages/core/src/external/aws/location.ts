import * as AWS from "aws-sdk";
import { PromiseResult } from "aws-sdk/lib/request";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
dayjs.extend(duration);

export function makeLocationClient(region: string): AWS.Location {
  return new AWS.Location({ signatureVersion: "v4", region });
}

export function getLocationResultPayload({
  result,
}: {
  result: PromiseResult<AWS.Location.SearchPlaceIndexForTextResponse, AWS.AWSError>;
}) {
  // TODO: copy lambda.ts structure here
  return result.Results;
}

export function getCoordinatesFromLocation({
  result,
}: {
  result: PromiseResult<AWS.Location.SearchPlaceIndexForTextResponse, AWS.AWSError>;
}) {
  const resp = getLocationResultPayload({ result });
  const topSuggestion = resp[0]?.Place?.Geometry?.Point;

  if (topSuggestion && topSuggestion[0] && topSuggestion[1]) {
    return { lon: topSuggestion[0], lat: topSuggestion[1] };
  }

  throw new Error("No location found");
}
