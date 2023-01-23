import { useState, useEffect, useCallback, Dispatch, SetStateAction } from "react";
import { getApi } from "../../../shared/api";
import { sleep } from "../../../shared/util";
import { DefaultProvider } from "./connect-providers";
import ErrorDialog, { DEFAULT_ERROR_MESSAGE } from "./error-dialog";
import Provider from "./provider";

type ProvidersProps = {
  providers: DefaultProvider[];
  connectedProviders: string[];
  setConnectedProviders: Dispatch<SetStateAction<string[]>>;
};

declare global {
  interface Window {
    webkit: any; //eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

const Providers = ({ providers, connectedProviders, setConnectedProviders }: ProvidersProps) => {
  const [isLoading, setIsLoading] = useState<{ [id: string]: boolean }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      // TODO #135 send err to Sentry
      console.log(err.message);
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
