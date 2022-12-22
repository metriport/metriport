import { Avatar, Card, Container, Text, Grid } from "@chakra-ui/react";

import { DefaultProvider } from "./connect-providers";
import ConnectButton from "./connect-button";

export type ProviderProps = {
  provider: DefaultProvider;
  isLoading: { [id: string]: boolean };
  isConnected: boolean;
  onRedirect: (provider: string) => void;
};

const Provider = (props: ProviderProps) => {
  const capitalizeFirstLetter = (string: String) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  return (
    <Container>
      <Card align={"stretch"} p={6} m={2}>
        <Grid templateColumns={"repeat(3, 1fr)"}>
          <Avatar
            src={require(`../../../assets/${props.provider.image}`)}
          ></Avatar>
          <Text fontSize={{ base: 14, sm: "md" }} pl={1} alignSelf={"center"}>
            {capitalizeFirstLetter(props.provider.name)}
          </Text>
          <ConnectButton {...props} />
        </Grid>
      </Card>
    </Container>
  );
};

export default Provider;
