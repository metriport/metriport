export const storeColorMode = (colorMode: string | null) => {
  if (colorMode) {
    localStorage.setItem("chakra-ui-color-mode", colorMode);
  }
};