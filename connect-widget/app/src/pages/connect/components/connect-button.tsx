import {
  Text,
  IconButton,
  useBreakpointValue,
  Box,
  Center,
} from "@chakra-ui/react";

import { ProviderProps } from "./provider";
import Constants from "../../../shared/constants";

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

  const garmin = useBreakpointValue({
    base: <Text p="4">+</Text>,
    sm: <Text p="4">Coming Soon!</Text>,
  });

  return (
    <Box>
      <Center>
        {provider.name === "garmin" ? (
          <IconButton
            border="1px"
            borderColor={Constants.PRIMARY_COLOR}
            p={2}
            w={btnWidth}
            aria-label="Connect"
            bg={"white"}
            color={Constants.PRIMARY_COLOR}
            isDisabled={true}
            icon={garmin}
          ></IconButton>
        ) : (
          <IconButton
            p={2}
            w={btnWidth}
            colorScheme="blue"
            aria-label="Connect"
            bg={Constants.PRIMARY_COLOR}
            color="white"
            _hover={{
              bg: Constants.HOVER_COLOR,
            }}
            isDisabled={isConnected}
            icon={content}
            onClick={() => onRedirect(provider.name)}
            isLoading={isLoading[provider.name]}
          ></IconButton>
        )}
      </Center>
    </Box>
  );
};

export default ConnectButton;
