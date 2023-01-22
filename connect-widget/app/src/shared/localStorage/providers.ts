import { DefaultProvider } from "../../pages/connect/components/connect-providers";

const defaultProviders: DefaultProvider[] = [
  { name: "apple", image: "apple.png" },
  { name: "fitbit", image: "fitbit.webp" },
  { name: "garmin", image: "garmin.webp" },
  { name: "oura", image: "oura.webp" },
  { name: "withings", image: "withings.png" },
  { name: "whoop", image: "whoop.png" },
  { name: "cronometer", image: "cronometer.webp" },
];

const providersLocalStorageKey = "providers";

export const getProviders = (
  providerParams: string | null,
  isDemo: boolean,
  isApple: string | null
): DefaultProvider[] => {
  const providers = toggleProvidersWithApple(defaultProviders, isApple);
  const validProviders = getValidProviders(providers, providerParams);

  if (validProviders) {
    if (!isDemo) {
      localStorage.setItem(providersLocalStorageKey, JSON.stringify(validProviders));
    }

    return validProviders;
  }

  const localProviders = getLocalStorageProviders();

  if (localProviders) {
    return localProviders;
  }

  return providers;
};

const getValidProviders = (providers: DefaultProvider[], providerParams: string | null) => {
  if (providerParams) {
    const providerArr = providerParams.split(",");
    const validProviders = providers.filter(provider => providerArr.includes(provider.name));

    if (validProviders.length) {
      return validProviders;
    }

    return providers;
  }

  return null;
};

const getLocalStorageProviders = (): DefaultProvider[] | null => {
  const localStorageProviders = localStorage.getItem(providersLocalStorageKey);

  if (localStorageProviders) {
    const parsedValue = JSON.parse(localStorageProviders);
    return parsedValue;
  }

  return null;
};

const toggleProvidersWithApple = (providers: DefaultProvider[], isApple: string | null) => {
  if (isApple) {
    return providers;
  }

  return providers.filter(provider => provider.name !== "apple");
};
