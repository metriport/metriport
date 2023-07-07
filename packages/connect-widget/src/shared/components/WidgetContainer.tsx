import {
  Box,
  Image,
  Text,
  useColorModeValue,
  Flex,
  extendTheme,
  ChakraProvider,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { isDemo } from "../api";

import Constants from "../../shared/constants";
import { getCustomColor } from "../localStorage/custom-color";
import { ChevronDownIcon } from "@chakra-ui/icons";

type WidgetContainerProps = {
  children: JSX.Element;
};

const WidgetContainer = ({ children }: WidgetContainerProps) => {
  const [searchParams] = useSearchParams();

  const color = searchParams.get(Constants.CUSTOM_COLOR_PARAM);

  const customColor = getCustomColor(color, isDemo);

  const decidePrimaryColor = `${customColor ? customColor : Constants.PRIMARY_COLOR} !important`;

  const decideHollowColor = `${useColorModeValue("white", "grey.700")} !important`;

  const theme = extendTheme({
    breakpoints: Constants.BREAKPOINTS,
    styles: { global: () => ({ body: { bg: "" } }) },
    components: {
      Button: {
        baseStyle: {
          backgroundColor: decidePrimaryColor,
          _hover: {
            backgroundColor: `${customColor ? customColor : Constants.HOVER_COLOR} !important`,
            ...(customColor ? { opacity: 0.8 } : undefined),
          },
        },
        variants: {
          hollow: {
            color: decidePrimaryColor,
            borderColor: decidePrimaryColor,
            backgroundColor: decideHollowColor,
            _hover: {
              backgroundColor: decideHollowColor,
            },
          },
          solid: {
            color: "white",
          },
        },
      },
    },
  });

  const childBox = document.getElementById("childBox");
  const [displayIcon, setDisplayIcon] = useState(false);

  const updateIconVisibility = () => {
    if (!childBox) return;
    const isProvidersList = children.props.children[0].type.name === "ConnectProviders";
    const isContainerSmaller = childBox.scrollHeight > childBox.clientHeight;
    const isNotScrolledToBottom =
      childBox.scrollHeight - childBox.scrollTop > childBox.clientHeight + 1;

    setDisplayIcon(isProvidersList && isContainerSmaller && isNotScrolledToBottom);
  };

  useEffect(() => {
    updateIconVisibility();
  }, [children]);

  useEffect(() => {
    const handleResize = () => {
      updateIconVisibility();
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [children.props.children[0]]);

  const handleScroll = () => {
    updateIconVisibility();
  };

  const resetScroll = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    resetScroll.current!.scrollTo(0, 0);
  }, [children]);

  return (
    <ChakraProvider theme={theme}>
      <Flex
        bg={useColorModeValue("gray.100", "gray.900")}
        height={"100vh"}
        mx={{ base: 5, md: 16, lg: 10 }}
        align="center"
        justify="center"
        css={{
          backgroundImage: useColorModeValue("gray.100", "gray.900"),
          backgroundAttachment: "fixed",
        }}
      >
        <Box
          position="relative"
          bg={useColorModeValue("white", "gray.700")}
          borderRadius="lg"
          width={{ base: 500 }}
          color={useColorModeValue("gray.700", "whiteAlpha.900")}
          shadow="base"
        >
          <Flex
            bg={useColorModeValue("gray.200", "gray.800")}
            p={1}
            borderTopRadius={"lg"}
            justify={"center"}
            align={"center"}
          >
            <Text mr={2}>Powered by</Text>
            <Image width={150} src={require("../../assets/metriport-logo.png")}></Image>
          </Flex>
          <Box
            px={8}
            pt={6}
            id="childBox"
            ref={resetScroll}
            maxHeight={"80vh"}
            overflowY={"scroll"}
            onScroll={handleScroll}
            css={{
              "&::-webkit-scrollbar": {
                width: "0.2rem",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "gray",
                borderRadius: "0.25rem",
              },
            }}
          >
            {children}
          </Box>
          {displayIcon && (
            <Box
              position="absolute"
              bottom={0}
              left={0}
              right={0}
              display="flex"
              justifyContent="center"
            >
              <ChevronDownIcon boxSize={12} color={decidePrimaryColor} opacity={0.5} />
            </Box>
          )}
        </Box>
      </Flex>
    </ChakraProvider>
  );
};

export default WidgetContainer;
