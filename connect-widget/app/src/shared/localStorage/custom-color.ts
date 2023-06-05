const colorLocalStorageKey = "custom-color";

export const getCustomColor = (paramColor: string | null, isDemo: boolean) => {
  const color = validateColor(paramColor);

  if (color) {
    if (!isDemo && localStorage) {
      localStorage.setItem(colorLocalStorageKey, color);
    }

    return color;
  }

  const localColor = getLocalStorageColor();

  if (localColor) {
    return localColor;
  }

  return null;
};

const validateColor = (paramColor: string | null) => {
  if (paramColor) {
    const s = new Option().style;
    s.color = paramColor;
    return paramColor;
  }

  return null;
};

const getLocalStorageColor = (): string | null => {
  return localStorage ? localStorage.getItem(colorLocalStorageKey) : null;
};
