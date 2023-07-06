import { Text, Button, useBreakpointValue, Box, Center } from "@chakra-ui/react";

import { ProviderProps } from "./provider";

const ConnectButton = ({
  isDisabled,
  isLoading,
  isConnected,
  provider,
  onRedirect,
}: ProviderProps) => {
  const content = useBreakpointValue({
    base: <Text p="4">{isConnected ? "\u2713" : "+"}</Text>,
    sm: <Text p="4">{isConnected ? "Connected" : "Connect"}</Text>,
  });

  const btnWidth = useBreakpointValue({
    base: "10%",
    sm: 125,
  });

  return (
    <Box>
      <Center>
        <Button
          p={2}
          w={btnWidth}
          aria-label="Connect"
          isDisabled={isDisabled || isConnected}
          onClick={() => onRedirect(provider.name)}
          isLoading={isLoading[provider.name]}
        >
          {content}
        </Button>
      </Center>
    </Box>
  );
};

export default ConnectButton;
