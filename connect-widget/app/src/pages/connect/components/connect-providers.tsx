import { Heading, Flex } from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../../../shared/api";
import Providers from "./providers";
import { getProviders } from "../../../shared/localStorage/providers";
import Constants from "../../../shared/constants";

export type DefaultProvider = {
  name: string;
  image: string;
};

const ConnectProviders = () => {
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // TODO: NPM I  AND ADD ZOD TO INCOMING REQUEST
    async function getConnectedProviders() {
      const { data } = await api.get("/connect/user/providers");

      setConnectedProviders(data);
    }

    getConnectedProviders();
  }, []);
  const searchProviders = searchParams.get(Constants.PROVIDERS_PARAM);
  const providers = getProviders(searchProviders);

  return (
    <>
      <Flex justify={"center"}>
        <Heading mb={2} textAlign={"center"}>
          Connect your sources.
        </Heading>
      </Flex>
      <Providers
        providers={providers}
        connectedProviders={connectedProviders}
      />
    </>
  );
};

export default ConnectProviders;
