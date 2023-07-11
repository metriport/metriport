import { Heading, Flex, Text, Icon, Box, Image } from "@chakra-ui/react";
import { LinkIcon, LockIcon } from "@chakra-ui/icons";
import { GiHealthNormal } from "react-icons/gi";
import { ImClipboard } from "react-icons/im";

import hippa from "../../../assets/hipaa.jpg";
import soc2 from "../../../assets/soc2.png";

const Agreement = () => {
  return (
    <Box position="relative">
      <Heading fontSize={28} mb={8} textAlign={"center"}>
        This app uses Metriport to connect your accounts
      </Heading>
      <Point
        icon={<LinkIcon mr={2} />}
        title="Connect effortlessly"
        body="Metriport lets you securely connect your health accounts in seconds."
      />
      <Point
        icon={<LockIcon mr={2} />}
        title="Your data is secure and encrypted"
        body="Your personal data is encrypted and only accessible through your consent."
      />
      <Point
        icon={<Icon as={GiHealthNormal} mr={2} />}
        title="Health data"
        body="You are providing this app access to your health data - including sleep, workouts, and other data points."
      />
      <Point
        icon={<Icon as={ImClipboard} mr={2} />}
        title="HIPAA & SOC 2 compliant"
        body="Metriport is a SOC 2 and HIPAA compliant organization."
        footer={
          <Box mt={2} display={"flex"}>
            <Image boxSize={"50px"} mr={4} objectFit="contain" src={hippa} alt="Hipaa" />
            <Image boxSize={"50px"} objectFit="contain" src={soc2} alt="Hipaa" />
          </Box>
        }
      />
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
