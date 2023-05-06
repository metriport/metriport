import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { setupApi } from "../../shared/api";
import WidgetContainer from "../../shared/components/WidgetContainer";
import Constants from "../../shared/constants";
import { acceptAgreement, setAgreementState } from "../../shared/localStorage/agreement";
import { storeColorMode } from "../../shared/localStorage/color-mode";
import { capture } from "../../shared/notifications";
import Agreement from "./components/agreement";
import ConnectProviders from "./components/connect-providers";
import ErrorDialog from "./components/error-dialog";

const ConnectPage = () => {
  const [agreement, setAgreement] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [isError, setIsError] = useState(null);

  const colorMode = searchParams.get(Constants.COLOR_MODE_PARAM);
  const token = searchParams.get(Constants.TOKEN_PARAM);
  const isDemo = token === "demo";

  useEffect(() => {
    try {
      setupApi(searchParams);
      storeColorMode(colorMode);
      setAgreementState(setAgreement);
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setIsError(err.message);
      capture.error(err, { extra: { context: `connect.setup` } });
    }
    setIsLoading(false);
  }, [searchParams, colorMode]);

  return (
    <WidgetContainer>
      <>
        {isLoading ? (
          <></>
        ) : agreement ? (
          <ConnectProviders />
        ) : (
          <Agreement onAcceptAgreement={() => acceptAgreement(setAgreement, isDemo)} />
        )}
        {isError && <ErrorDialog message={isError} show onClose={() => setIsError(null)} />}
      </>
    </WidgetContainer>
  );
};

export default ConnectPage;
