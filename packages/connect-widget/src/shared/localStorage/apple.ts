import Constants from "../constants";
import { isDemo } from "../api";

const isAppleStorageKey = "is-apple";

export const getIsApple = (searchParams: URLSearchParams): boolean => {
  const isAppleParam = searchParams.get(Constants.APPLE_PARAM);

  const appleParamTrue = isAppleParam && isAppleParam === "true";

  if (appleParamTrue) {
    if (!isDemo && localStorage) {
      localStorage.setItem(isAppleStorageKey, isAppleParam);
    }

    return appleParamTrue;
  }

  return localStorage ? !!localStorage.getItem(isAppleStorageKey) : false;
};
