import * as React from "react";

import { StyleSheet } from "react-native";
import { MetriportWidget } from "@metriport/react-native-sdk";

export default function App() {
  return (
    <MetriportWidget
      token="CONNECT_TOKEN"
      clientApiKey="CLIENT_API_KEY"
      sandbox={false}
      style={styles.box}
    />
  );
}

const styles = StyleSheet.create({
  box: {
    width: "100%",
    height: "100%",
  },
});
