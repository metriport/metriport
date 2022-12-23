import { Heading, Flex } from "@chakra-ui/react";
import { useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";

import { api, setupApi } from "../../../shared/api";
import Providers from "./providers";

export type DefaultProvider = {
  name: string;
  image: string;
};

const providers: DefaultProvider[] = [
  { name: "fitbit", image: "fitbit.webp" },
  { name: "oura", image: "oura.webp" },
  { name: "cronometer", image: "cronometer.webp" },
  { name: "whoop", image: "whoop.png" },
  { name: "withings", image: "withings.png" },
  { name: "garmin", image: "garmin.webp" },
];

const ConnectProviders = () => {
  const [searchParams, _] = useSearchParams();
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);

  useEffect(() => {
    setupApi(api, searchParams);

    // TODO: NPM I  AND ADD ZOD TO INCOMING REQUEST
    async function getConnectedProviders() {
      const { data } = await api.get("/connect/user/providers");

      setConnectedProviders(data);
    }

    getConnectedProviders();
  }, [searchParams]);

  return (
    <>
      <Flex p={4} m={4} justify={"center"}>
        <Heading textAlign={"center"}>Connect your sources.</Heading>
      </Flex>
      <Providers
        providers={providers}
        connectedProviders={connectedProviders}
      />
    </>
  );
};

export default ConnectProviders;
