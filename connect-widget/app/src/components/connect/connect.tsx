import {
  Avatar,
  Box,
  Card,
  Container,
  Heading,
  Image,
  Text,
  VStack,
  IconButton,
  useColorModeValue,
  Flex,
  Stack,
  Grid,
  extendTheme,
  ChakraProvider,
  useBreakpointValue,
  Center,
} from "@chakra-ui/react";
import { useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { api, setupApi } from "../../shared/api";
import { isProdEnv } from "../../shared/util";
import Constants from "../../shared/constants";

const theme = extendTheme({
  breakpoints: Constants.BREAKPOINTS,
  styles: { global: () => ({ body: { bg: "" } }) },
});

type Provider = {
  name: string;
  image: string;
};

export default function Connect({}: {}) {
  const [searchParams, _] = useSearchParams();
  const [isLoading, setIsLoading] = useState<{ [id: string]: boolean }>({});
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const providers: Provider[] = [
    { name: "fitbit", image: "fitbit.webp" },
    { name: "oura", image: "oura.webp" },
    { name: "cronometer", image: "cronometer.webp" },
    { name: "whoop", image: "whoop.png" },
    { name: "withings", image: "withings.png" },
    { name: "garmin", image: "garmin.webp" },
  ];

  function getRedirectURLPath(): string {
    const urlBase = "/connect/redirect";
    return isProdEnv() ? `/token${urlBase}` : urlBase;
  }

  async function getRedirect(provider: string) {
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
  }

  function capitalizeFirstLetter(string: String) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

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
    <ChakraProvider theme={theme}>
      <Flex
        bg={useColorModeValue("gray.100", "gray.900")}
        align="center"
        justify="center"
        css={{
          backgroundImage: useColorModeValue("gray.100", "gray.900"),
          backgroundAttachment: "fixed",
        }}
      >
        <Box
          borderRadius="lg"
          m={{ base: 5, md: 16, lg: 10 }}
          py={{ base: 5, lg: 6 }}
          px={{ base: 0, lg: 6 }}
        >
          <VStack align="center">
            <Stack
              spacing={{ base: 4, md: 8, lg: 20 }}
              direction={{ base: "column", md: "row" }}
            >
              <Box
                bg={useColorModeValue("white", "gray.700")}
                borderRadius="lg"
                p={4}
                width={{ base: "100%", md: 500 }}
                color={useColorModeValue("gray.700", "whiteAlpha.900")}
                shadow="base"
              >
                <Flex
                  bg={"gray.200"}
                  m={-4}
                  p={1}
                  borderTopRadius={"lg"}
                  justify={"center"}
                  align={"center"}
                >
                  <Text mr={2}>Powered by</Text>
                  <Image width={150} src={"logo.png"}></Image>
                </Flex>
                <Flex p={4} m={4} justify={"center"}>
                  <Heading textAlign={"center"}>Connect your sources.</Heading>
                </Flex>
                {providers.map((value: Provider, index: number) => {
                  const isConnected = connectedProviders.includes(value.name);

                  return (
                    <Container key={index}>
                      <Card align={"stretch"} p={6} m={2}>
                        <Grid templateColumns={"repeat(3, 1fr)"}>
                          <Avatar
                            src={require(`../../assets/${value.image}`)}
                          ></Avatar>
                          <Text
                            fontSize={{ base: 14, sm: "md" }}
                            pl={1}
                            alignSelf={"center"}
                          >
                            {capitalizeFirstLetter(value.name)}
                          </Text>
                          <Box>
                            <Center>
                              <ButtonContent
                                isConnected={isConnected}
                                isLoading={isLoading}
                                provider={value}
                                redirect={getRedirect}
                              />
                            </Center>
                          </Box>
                        </Grid>
                      </Card>
                    </Container>
                  );
                })}
              </Box>
            </Stack>
          </VStack>
        </Box>
      </Flex>
    </ChakraProvider>
  );
}

const ButtonContent = ({
  isLoading,
  isConnected,
  provider,
  redirect,
}: {
  isLoading: { [id: string]: boolean };
  isConnected: boolean;
  provider: Provider;
  redirect: (provider: string) => void;
}) => {
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

  if (provider.name === "garmin") {
    return (
      <IconButton
        border="1px"
        borderColor="#748df0"
        p={2}
        w={btnWidth}
        aria-label="Connect"
        bg={"white"}
        color="#748df0"
        isDisabled={true}
        icon={garmin}
      ></IconButton>
    );
  }

  return (
    <IconButton
      p={2}
      w={btnWidth}
      colorScheme="blue"
      aria-label="Connect"
      bg={"#748df0"}
      color="white"
      _hover={{
        bg: "#879ced",
      }}
      isDisabled={isConnected}
      icon={content}
      onClick={() => redirect(provider.name)}
      isLoading={isLoading[provider.name]}
    ></IconButton>
  );
};
