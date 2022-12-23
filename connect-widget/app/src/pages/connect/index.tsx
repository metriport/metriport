import { useState, useEffect } from "react";

import WidgetContainer from "../../shared/components/WidgetContainer";
import ConnectProviders from "./components/connect-providers";
import Agreement from "./components/agreement";

const ConnectPage = () => {
  const [agreement, setAgreement] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const agreementLocalStorageKey = "agreement-accepted-v1";

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

  useEffect(() => {
    const localStorageAgreement = getLocalStorageAgreement();

    if (localStorageAgreement) {
      setAgreement(localStorageAgreement);
    }
    setIsLoading(false);
  }, []);

  const acceptAgreement = (): void => {
    localStorage.setItem(agreementLocalStorageKey, JSON.stringify(true));
    setAgreement(true);
  };

  return (
    <WidgetContainer>
      {isLoading ? (
        <></>
      ) : agreement ? (
        <ConnectProviders />
      ) : (
        <Agreement onAcceptAgreement={acceptAgreement} />
      )}
    </WidgetContainer>
  );
};

export default ConnectPage;
