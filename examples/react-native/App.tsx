import * as React from "react";

import { StyleSheet } from "react-native";
import { MetriportWidget } from "@metriport/react-native-sdk";

export default function App() {
  return (
    <MetriportWidget
      token="QZ92CiSD_gtihMJLBwQCQ"
      clientApiKey="ck9kMkJzWU5qSS1nQ0wtVzVTenFTOjIxZmE0MzJlLTcyM2ItNGExZC1hM2IyLWJkOWNkNzVhMDcxNw"
      colorMode="dark"
      customColor="green"
      sandbox={false}
      // providers={["fitbit", "cronometer"]}
      style={styles.box}
      apiUrl="http://172.20.10.4:8080"
      url="http://172.20.10.4:3001"
    />
  );
}

const styles = StyleSheet.create({
  box: {
    width: "100%",
    height: "100%",
  },
});
