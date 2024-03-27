import { Box } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { isDemo, setupApi } from "../../shared/api";
import WidgetContainer from "../../shared/components/WidgetContainer";
import Constants from "../../shared/constants";
import { acceptAgreement, setAgreementState } from "../../shared/localStorage/agreement";
import { storeColorMode } from "../../shared/localStorage/color-mode";
import { storeFailRedirectUrl, storeRedirectUrl } from "../../shared/localStorage/redirect-url";
import { DemoTokenError } from "../../shared/token-errors";
import Agreement from "./components/agreement";
import AgreementFooter from "./components/agreement-footer";
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
  const redirectUrl = searchParams.get(Constants.SUCCESS_REDIRECT_URL_PARAM);
  const failRedirectUrl = searchParams.get(Constants.FAILURE_REDIRECT_URL_PARAM);

  useEffect(() => {
    async function setupConnectPage() {
      try {
        storeColorMode(colorMode);
        storeRedirectUrl(redirectUrl);
        storeFailRedirectUrl(failRedirectUrl);
        setAgreementState(setAgreement);
        await setupApi(searchParams);
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (err.message !== DemoTokenError.DEFAULT_MSG) {
          setError(err);
        }
      }
      setIsLoading(false);
    }
    setupConnectPage();
  }, [searchParams, colorMode]);

  return (
    <WidgetContainer>
      <>
        {isLoading ? (
          <></>
        ) : agreement ? (
          <ConnectProviders />
        ) : (
          <Box position="relative">
            <Agreement />
            <AgreementFooter onAcceptAgreement={() => acceptAgreement(setAgreement, isDemo)} />
          </Box>
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
