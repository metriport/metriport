import { useState } from "react";
import { getApi } from "../../../shared/api";
import { sleep } from "../../../shared/util";
import { DefaultProvider } from "./connect-providers";
import ErrorDialog, { DEFAULT_ERROR_MESSAGE } from "./error-dialog";
import Provider from "./provider";

type ProvidersProps = {
  providers: DefaultProvider[];
  connectedProviders: string[];
};

const Providers = ({ providers, connectedProviders }: ProvidersProps) => {
  const [isLoading, setIsLoading] = useState<{ [id: string]: boolean }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  return (
    <>
      {providers.map((value: DefaultProvider, index: number) => {
        const isConnected = connectedProviders.includes(value.name);

        return (
          <Provider
            key={index}
            isConnected={isConnected}
            isLoading={isLoading}
            provider={value}
            onRedirect={redirectToProvider}
          />
        );
      })}
      {errorMessage && (
        <ErrorDialog
          show
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}
    </>
  );
};

export default Providers;
