const isAppleStorageKey = "is-apple";

export const getIsApple = (isApple: string | null, isDemo: boolean) => {
  if (isApple) {
    if (!isDemo && localStorage) {
      localStorage.setItem(isAppleStorageKey, isApple);
    }

    return isApple;
  }

  return localStorage ? localStorage.getItem(isAppleStorageKey) : null;
};
