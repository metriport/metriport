/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

// NOTE: This was moved from github into our repo to avoid supply chain risk
// Original source: https://github.com/ShieldBattery/node-interval-tree/blob/master/index.ts

import shallowEqualArrays from "./arrays";
import shallowEqualObjects from "./objects";

type Comparable = Record<string, any> | any[] | null | undefined;

function shallowEqual<T extends Comparable>(a: T, b: T): boolean {
  const aIsArr = Array.isArray(a);
  const bIsArr = Array.isArray(b);

  if (aIsArr !== bIsArr) {
    return false;
  }

  if (aIsArr && bIsArr) {
    return shallowEqualArrays(a, b);
  }

  return shallowEqualObjects(a, b);
}

export { shallowEqual, shallowEqualObjects, shallowEqualArrays };
