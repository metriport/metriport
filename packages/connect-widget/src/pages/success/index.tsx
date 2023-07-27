import { CheckCircleIcon } from "@chakra-ui/icons";
import { Container, Flex, Heading, Text, Card, IconButton } from "@chakra-ui/react";
import { useNavigate, useSearchParams } from "react-router-dom";

import WidgetContainer from "../../shared/components/WidgetContainer";
import { redirectToCustomUrl, redirectToMain } from "../../shared/util";
import Analytics from "../../shared/analytics";
import Constants from "../../shared/constants";

export default function Success() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const handleClick = () => {
    Analytics.emit(Analytics.events.connectSuccess);
    const redirectUrl = localStorage.getItem(Constants.SUCCESS_REDIRECT_URL_PARAM);
    if (redirectUrl) {
      redirectToCustomUrl(redirectUrl);
      return;
    }
    redirectToMain(navigate, searchParams);
  };

  return (
    <WidgetContainer>
      <>
        <Flex pb={2} justify={"center"}>
          <CheckCircleIcon mt={4} boxSize={"60px"} color={"green.300"} />
        </Flex>
        <Flex my={4} justify={"center"}>
          <Heading textAlign={"center"}>Successfully connected!</Heading>
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
