import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import WidgetContainer from "../../shared/components/WidgetContainer";
import ConnectProviders from "./components/connect-providers";
import Agreement from "./components/agreement";
import { api, setupApi } from "../../shared/api";
import Constants from "../../shared/constants";
import {
  setAgreementState,
  acceptAgreement,
} from "../../shared/localStorage/agreement";
import { storeColorMode } from "../../shared/localStorage/color-mode";

const ConnectPage = () => {
  const [agreement, setAgreement] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams, _] = useSearchParams();

  const colorMode = searchParams.get(Constants.COLOR_MODE_PARAM);
  const token = searchParams.get(Constants.TOKEN_PARAM);
  const isDemo = token === "demo";

  useEffect(() => {
    setupApi(api, searchParams);
    setAgreementState(setAgreement);
    storeColorMode(colorMode);

    setIsLoading(false);
  }, [searchParams, colorMode]);

  return (
    <WidgetContainer>
      {isLoading ? (
        <></>
      ) : agreement ? (
        <ConnectProviders />
      ) : (
        <Agreement
          onAcceptAgreement={() => acceptAgreement(setAgreement, isDemo)}
        />
      )}
    </WidgetContainer>
  );
};

export default ConnectPage;
