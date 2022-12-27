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

  useEffect(() => {
    setupApi(api, searchParams);
    storeColorMode(colorMode);
    setAgreementState(setAgreement);

    setIsLoading(false);
  }, [searchParams, colorMode]);

  return (
    <WidgetContainer>
      {isLoading ? (
        <></>
      ) : agreement ? (
        <ConnectProviders />
      ) : (
        <Agreement onAcceptAgreement={() => acceptAgreement(setAgreement)} />
      )}
    </WidgetContainer>
  );
};

export default ConnectPage;
