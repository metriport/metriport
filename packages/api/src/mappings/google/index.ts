import { Sample } from "@metriport/api-sdk/devices/models/common/sample";
import dayjs from "dayjs";
import convert from "convert-units";

import { GooglePoint } from "./models";

export const getSamples = (arr: GooglePoint, valueIndex = 0): Sample[] => {
  return arr.map(item => {
    const hasFpVal = item.value.filter(val => val.fpVal);
    const startTimeNanos = Number(item.startTimeNanos);

    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      value: hasFpVal[valueIndex].fpVal!,
      time: dayjs(convert(startTimeNanos).from("ns").to("ms")).toISOString(),
    };
  });
};

export enum ValueKey {
  fpVal = "fpVal",
  intVal = "intVal",
}

export const getValues = (arr: GooglePoint, key: ValueKey = ValueKey.fpVal): number[] => {
  return arr.reduce((acc, curr) => {
    curr.value.forEach(val => {
      const fpVal = val[key];
      if (fpVal) acc.push(fpVal);
    });
    return acc;
  }, [] as number[]);
};
