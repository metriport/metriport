import { Avatar, Card, Box, Text, Grid } from "@chakra-ui/react";

import { DefaultProvider } from "./connect-providers";
import ConnectButton from "./connect-button";

export type ProviderProps = {
  provider: DefaultProvider;
  isLoading: { [id: string]: boolean };
  isConnected: boolean;
  isDisabled: boolean;
  onRedirect: (provider: string) => void;
};

const Provider = (props: ProviderProps) => {
  const capitalizeFirstLetter = (v: string) => {
    return v.charAt(0).toUpperCase() + v.slice(1);
  };

  return (
    <Box>
      <Card align={"stretch"} p={6} m={2}>
        <Grid templateColumns={"repeat(3, 1fr)"}>
          <Avatar src={require(`../../../assets/${props.provider.image}`)}></Avatar>
          <Text fontSize={{ base: 14, sm: "md" }} pl={1} alignSelf={"center"}>
            {capitalizeFirstLetter(props.provider.name)}
          </Text>
          <ConnectButton {...props} />
        </Grid>
      </Card>
    </Box>
  );
};

export default Provider;
