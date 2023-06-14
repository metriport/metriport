import { Flex, Button, Box, Divider, Text, Link, useColorModeValue } from "@chakra-ui/react";

type AgreementProps = {
  onAcceptAgreement: () => void;
};

const AgreementFooter = ({ onAcceptAgreement }: AgreementProps) => {
  return (
    <Box
      position="sticky"
      bg={useColorModeValue("white", "gray.700")}
      bottom={0}
      left={0}
      right={0}
    >
      <Divider mb={4} />
      <Flex px={6} justifyContent={"center"}>
        <Text textAlign={"center"}>
          By selecting "Continue", you agree to the{" "}
          <Link textDecor={"underline"} href="https://metriport.com/privacy/" isExternal>
            Metriport End User Privacy Policy
          </Link>
        </Text>
      </Flex>
      <Flex justifyContent={"center"} pb={2} pt={2}>
        <Button size="lg" p={4} width={"75%"} onClick={onAcceptAgreement}>
          Continue
        </Button>
      </Flex>
    </Box>
  );
};

export default AgreementFooter;
