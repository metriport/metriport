import { NotAllowedIcon } from "@chakra-ui/icons";
import { Box, useColorModeValue, Container, Flex, Heading, VStack, Text, Image, Stack, Card, IconButton } from "@chakra-ui/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { redirectToMain } from "../../shared/util";

export default function Error({}: {}) {
  const [searchParams, _] = useSearchParams();
  const navigate = useNavigate();
  const handleClick = () => redirectToMain(navigate, searchParams);
  return (
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
        p={{ base: 5, lg: 6 }}
      >
        <VStack align="stretch">
          <Stack
            spacing={{ base: 4, md: 8, lg: 20 }}
            direction={{ base: "column", md: "row" }}
          >
            <Box
              bg={useColorModeValue("white", "gray.700")}
              borderRadius="lg"
              p={4}
              width={500}
              color={useColorModeValue("gray.700", "whiteAlpha.900")}
              shadow="base"
            >
              <Flex bg={"gray.200"} m={-4} p={1} borderTopRadius={'lg'} justify={'center'} align={'center'}>
                <Text mr={2}>Powered by</Text>
                <Image width={150} src={'logo.png'}></Image>
              </Flex>
              <Flex p={2} mt={6} justify={'center'}>
                <NotAllowedIcon mt={4} boxSize={'60px'} color={'red.300'} />
              </Flex>
              <Flex p={2} m={4} justify={'center'} textAlign="center">
                <Heading>Ensure you've authorized access to all scopes and try again.</Heading>
              </Flex>
                <Container>
                  <Card align={'center'} shadow={'none'} p={6}>
                    <IconButton
                      p={2}
                      colorScheme="blue"
                      aria-label="Continue"
                      bg="#748df0"
                            color="white"
                            _hover={{
                              bg: "#879ced",
                            }}
                      icon={<Text p="4">Continue</Text>}
                      onClick={handleClick}
                    ></IconButton>
                  </Card>
                </Container>
            </Box>
          </Stack>
        </VStack>
      </Box>
    </Flex>
  );
}
