
const agreementLocalStorageKey = "agreement-accepted-v1";

export const setAgreementState = (setAgreement: (value: boolean) => void) => {
  const localStorageAgreement = getLocalStorageAgreement();

  if (localStorageAgreement) {
    setAgreement(localStorageAgreement);
  }
}

const getLocalStorageAgreement = (): boolean => {
  const localStorageAgreement = localStorage.getItem(
    agreementLocalStorageKey
  );

  if (localStorageAgreement) {
    const parsedValue = JSON.parse(localStorageAgreement);

    return parsedValue;
  }

  return false;
};

export const acceptAgreement = (setAgreement: (value: boolean) => void, isDemo: boolean): void => {
  if (!isDemo) {
    localStorage.setItem(agreementLocalStorageKey, JSON.stringify(true));
  }

  setAgreement(true);
};