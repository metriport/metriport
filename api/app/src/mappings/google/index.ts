import { Sample } from '@metriport/api/lib/models/common/sample'
import dayjs from "dayjs";
import convert from 'convert-units';

import { GooglePoint } from "./models";

export const getSamples = (arr: GooglePoint, valueIndex: number = 0): Sample[] => {
  return arr.map(item => {
    const hasFpVal = item.value.filter(val => val.fpVal);
    const startTimeNanos = Number(item.startTimeNanos);

    return {
      value: hasFpVal[valueIndex].fpVal!,
      time: dayjs(convert(startTimeNanos).from('ns').to('ms')).format(
        "YYYY-MM-DDTHH:mm:ssZ"
      )
    }
  })
}

export enum ValueKey {
  fpVal = "fpVal",
  intVal = "intVal"
}

export const getValues = (arr: GooglePoint, key: ValueKey = ValueKey.fpVal): number[] => {
  return arr.reduce((acc, curr) => {
    const hasFpVal = curr.value.filter(val => val[key]);

    hasFpVal.forEach(val => {
      acc.push(val[key]!)
    })

    return acc;
  }, [] as number[])
}