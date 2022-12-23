import {
  Box,
  Image,
  Text,
  VStack,
  useColorModeValue,
  Flex,
  Stack,
  extendTheme,
  ChakraProvider,
} from "@chakra-ui/react";

import Constants from "../../shared/constants";

const theme = extendTheme({
  breakpoints: Constants.BREAKPOINTS,
  styles: { global: () => ({ body: { bg: "" } }) },
});

type WidgetContainerProps = {
  children: JSX.Element;
};

const WidgetContainer = ({ children }: WidgetContainerProps) => {
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
                {children}
              </Box>
            </Stack>
          </VStack>
        </Box>
      </Flex>
    </ChakraProvider>
  );
};

export default WidgetContainer;
