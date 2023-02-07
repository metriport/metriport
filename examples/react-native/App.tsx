import * as React from "react";

import { StyleSheet, Platform } from "react-native";
import { MetriportWidget } from "@metriport/react-native-sdk";
import { WebView } from "react-native-webview";

export default function App() {
  if (Platform.OS === "ios") {
    return (
      <MetriportWidget
        token="CONNECT_SESSION_TOKEN"
        clientApiKey="CLIENT_API_KEY"
        sandbox={false}
        style={styles.box}
      />
    );
  }

  return (
    <WebView source={{ uri: "https://connect.metriport.com/?token=demo" }} />
  );
}

const styles = StyleSheet.create({
  box: {
    width: "100%",
    height: "100%",
  },
});
