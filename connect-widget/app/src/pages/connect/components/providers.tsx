import { useState } from "react";

import { api } from "../../../shared/api";
import { isProdEnv } from "../../../shared/util";
import Provider from "./provider";
import { DefaultProvider } from "./connect-providers";

type ProvidersProps = {
  providers: DefaultProvider[];
  connectedProviders: string[];
};

const Providers = ({ providers, connectedProviders }: ProvidersProps) => {
  const [isLoading, setIsLoading] = useState<{ [id: string]: boolean }>({});

  const getRedirectURLPath = (): string => {
    const urlBase = "/connect/redirect";
    return isProdEnv() ? `/token${urlBase}` : urlBase;
  };

  const redirectToProvider = async (provider: string) => {
    setIsLoading({
      ...isLoading,
      [provider]: true,
    });

    try {
      const resp = await api.get(getRedirectURLPath(), {
        params: { provider },
      });
      window.location.href = resp.data;
    } catch (error) {
      console.error(error);
    }
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
    </>
  );
};

export default Providers;
