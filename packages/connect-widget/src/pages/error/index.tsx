import { NotAllowedIcon } from "@chakra-ui/icons";
import { Card, Container, Flex, Heading, IconButton, Text } from "@chakra-ui/react";
import { useNavigate, useSearchParams } from "react-router-dom";

import WidgetContainer from "../../shared/components/WidgetContainer";
import Constants from "../../shared/constants";
import { redirectToCustomUrl, redirectToMain } from "../../shared/util";

export default function Error() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const handleClick = () => {
    const redirectUrl = localStorage.getItem(Constants.FAILURE_REDIRECT_URL_PARAM);
    if (redirectUrl) {
      redirectToCustomUrl(redirectUrl);
      return;
    }
    redirectToMain(navigate, searchParams);
  };

  return (
    <WidgetContainer>
      <>
        <Flex pb={4} justify={"center"}>
          <NotAllowedIcon mt={4} boxSize={"60px"} color={"red.300"} />
        </Flex>
        <Flex justify={"center"} textAlign="center">
          <Heading>Ensure you've authorized access to all scopes and try again.</Heading>
        </Flex>
        <Container>
          <Card align={"center"} shadow={"none"} p={6}>
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
      </>
    </WidgetContainer>
  );
}
