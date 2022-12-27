import {
  Text,
  Button,
  useBreakpointValue,
  Box,
  Center,
} from "@chakra-ui/react";

import { ProviderProps } from "./provider";

const ConnectButton = ({
  isLoading,
  isConnected,
  provider,
  onRedirect,
}: ProviderProps) => {
  const content = useBreakpointValue({
    base: <Text p="4">+</Text>,
    sm: <Text p="4">{isConnected ? "Connected" : "Connect"}</Text>,
  });

  const btnWidth = useBreakpointValue({
    base: "10%",
    sm: 125,
  });

  return (
    <Box>
      <Center>
        {provider.name === "garmin" ? (
          <ComingSoon btnWidth={btnWidth} />
        ) : (
          <Button
            p={2}
            w={btnWidth}
            aria-label="Connect"
            isDisabled={isConnected}
            onClick={() => onRedirect(provider.name)}
            isLoading={isLoading[provider.name]}
          >
            {content}
          </Button>
        )}
      </Center>
    </Box>
  );
};

const ComingSoon = ({ btnWidth }: { btnWidth: any }) => {
  const garmin = useBreakpointValue({
    base: <Text p="4">+</Text>,
    sm: <Text p="4">Coming Soon!</Text>,
  });

  return (
    <Button
      border="1px"
      p={2}
      w={btnWidth}
      variant={"hollow"}
      isDisabled={true}
    >
      {garmin}
    </Button>
  );
};

export default ConnectButton;
