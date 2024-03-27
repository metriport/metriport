import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Analytics from "../../../shared/analytics";
import { getApi } from "../../../shared/api";
import Constants from "../../../shared/constants";
import { sleep } from "../../../shared/util";
import { DefaultProvider } from "./connect-providers";
import ErrorDialog, { DEFAULT_ERROR_MESSAGE } from "./error-dialog";
import Provider from "./provider";

type ProvidersProps = {
  providers: DefaultProvider[];
  isDemo: boolean;
  connectedProviders: string[];
  setConnectedProviders: Dispatch<SetStateAction<string[]>>;
};

declare global {
  interface Window {
    webkit: any; //eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

const Providers = ({
  providers,
  isDemo,
  connectedProviders,
  setConnectedProviders,
}: ProvidersProps) => {
  const [isLoading, setIsLoading] = useState<{ [id: string]: boolean }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const token = isDemo ? "" : searchParams.get(Constants.TOKEN_PARAM);

  const customEventHandler = useCallback(
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (e: any) => {
      try {
        if (e.detail.success) {
          const { data } = await getApi().get("/connect/user/apple");

          window?.webkit?.messageHandlers?.connect?.postMessage(data);

          setConnectedProviders(["apple", ...connectedProviders]);
        } else {
          setErrorMessage("Error while authorizing healthkit");
        }

        setIsLoading({
          ...isLoading,
          apple: false,
        });
      } catch (error) {
        setErrorMessage("Error while authorizing healthkit");
        setIsLoading({
          ...isLoading,
          apple: false,
        });
      }
    },
    [setIsLoading, isLoading, connectedProviders, setConnectedProviders]
  );

  useEffect(() => {
    window.addEventListener("authorization", customEventHandler);

    return () => window.removeEventListener("authorization", customEventHandler);
  }, [customEventHandler]);

  const redirectToProvider = async (provider: string) => {
    setIsLoading({
      ...isLoading,
      [provider]: true,
    });

    Analytics.emit(Analytics.events.connectProvider, {
      provider,
    });

    try {
      const resp = await getApi().get("/connect/redirect", {
        params: { provider },
      });
      window.location.href = resp.data;
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.message.includes("403")) {
        setErrorMessage(`Token expired, restart the connect session.`);
      } else {
        setErrorMessage(DEFAULT_ERROR_MESSAGE);
      }
    }
    sleep(2_000).then(() => {
      setIsLoading({
        ...isLoading,
        [provider]: false,
      });
    });
  };

  const connectToApple = () => {
    setIsLoading({
      ...isLoading,
      apple: true,
    });

    window?.webkit?.messageHandlers?.connect?.postMessage("connect");
  };

  return (
    <>
      {providers.map((value: DefaultProvider, index: number) => {
        const isConnected = connectedProviders.includes(value.name);
        const isApple = value.name === "apple";

        return (
          <Provider
            key={index}
            isConnected={isConnected}
            isDisabled={!token}
            isLoading={isLoading}
            provider={value}
            onRedirect={isApple ? connectToApple : redirectToProvider}
          />
        );
      })}
      {errorMessage && (
        <ErrorDialog show message={errorMessage} onClose={() => setErrorMessage(null)} />
      )}
    </>
  );
};

export default Providers;
