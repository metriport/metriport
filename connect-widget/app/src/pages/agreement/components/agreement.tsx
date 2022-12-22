import {
  Heading,
  Flex,
  Button,
  Text,
  Icon,
  Box,
  Image,
  Divider,
  Link,
} from "@chakra-ui/react";
import { LinkIcon, LockIcon } from "@chakra-ui/icons";
import { GiHealthNormal } from "react-icons/gi";
import { GrCompliance } from "react-icons/gr";

import Constants from "../../../shared/constants";
import hippa from "../../../assets/hipaa.jpg";
import soc2 from "../../../assets/soc2.png";

type AgreementProps = {
  onAcceptAgreement: () => void;
};

const Agreement = ({ onAcceptAgreement }: AgreementProps) => {
  return (
    <Box p={4} m={4}>
      <Heading fontSize={32} mb={8} textAlign={"center"}>
        This app uses Metriport to connect your account
      </Heading>
      <Point
        icon={<LinkIcon mr={2} />}
        title="Connect effortlessly"
        body="Metriport lets you securely connect your medical accounts in seconds"
      />
      <Point
        icon={<LockIcon mr={2} />}
        title="Your data is secured"
        body="Metriport encrypts data at rest and in transit for all of our customers"
      />
      <Point
        icon={<Icon as={GiHealthNormal} mr={2} />}
        title="Health Data"
        body="You are providing this app access to your health data including your heart rate, sleep workouts among others."
      />
      <Point
        icon={<Icon as={GrCompliance} mr={2} />}
        title="HIPAA & SOC 2 Compliant"
        body="Metriport is a SOC 2 and HIPAA compliant organization"
        footer={
          <Box mt={2} display={"flex"}>
            <Image
              boxSize={"50px"}
              mr={4}
              objectFit="contain"
              src={hippa}
              alt="Hipaa"
            />
            <Image
              boxSize={"50px"}
              objectFit="contain"
              src={soc2}
              alt="Hipaa"
            />
          </Box>
        }
      />
      <Divider mb={4} />
      <Flex mb={4} px={6} justifyContent={"center"}>
        <Text textAlign={"center"}>
          By selecting "Continue" you agree to the{" "}
          <Link
            textDecor={"underline"}
            href="https://metriport.com/privacy/"
            isExternal
          >
            Metriport End User Privacy Policy
          </Link>
        </Text>
      </Flex>
      <Flex justifyContent={"center"}>
        <Button
          width={"90%"}
          bg={Constants.PRIMARY_COLOR}
          _hover={{
            bg: Constants.HOVER_COLOR,
          }}
          onClick={onAcceptAgreement}
        >
          <Text color={"white"}>Continue</Text>
        </Button>
      </Flex>
    </Box>
  );
};

type PointProps = {
  icon: JSX.Element;
  title: string;
  body: string;
  footer?: JSX.Element;
};

const Point = ({ icon, title, body, footer }: PointProps) => {
  return (
    <Flex mb={6} alignItems={"start"}>
      <Box mr={1} height={7} alignItems="center" display={"flex"}>
        {icon}
      </Box>
      <Box>
        <Text fontSize={18} fontWeight={"bold"} lineHeight={7}>
          {title}
        </Text>
        <Text>{body}</Text>
        {footer}
      </Box>
    </Flex>
  );
};

export default Agreement;
