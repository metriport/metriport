import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { setupApi, isDemo } from "../../shared/api";
import WidgetContainer from "../../shared/components/WidgetContainer";
import Constants from "../../shared/constants";
import { acceptAgreement, setAgreementState } from "../../shared/localStorage/agreement";
import { storeColorMode } from "../../shared/localStorage/color-mode";
import { capture } from "../../shared/notifications";
import Agreement from "./components/agreement";
import ConnectProviders from "./components/connect-providers";
import ErrorDialog from "./components/error-dialog";

type DisplayError = {
  message: string;
  link: string;
  title: string;
};

const ConnectPage = () => {
  const [agreement, setAgreement] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<DisplayError | null>(null);

  const colorMode = searchParams.get(Constants.COLOR_MODE_PARAM);

  useEffect(() => {
    try {
      setupApi(searchParams);
      storeColorMode(colorMode);
      setAgreementState(setAgreement);
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err);
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
        {error && (
          <ErrorDialog
            message={error.message}
            link={error.link}
            title={error.title}
            show
            onClose={() => setError(null)}
          />
        )}
      </>
    </WidgetContainer>
  );
};

export default ConnectPage;
