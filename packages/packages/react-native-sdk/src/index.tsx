import { requireNativeComponent, UIManager, Platform, ViewStyle } from "react-native";
import { WebView, WebViewProps } from "react-native-webview";

const LINKING_ERROR =
  `The package '@metriport/react-native-sdk' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: "" }) +
  "- You rebuilt the app after installing the package\n" +
  "- You are not using Expo Go\n";

type MetriportWidgetProps = {
  clientApiKey: string;
  token: string;
  sandbox: boolean;
  colorMode?: string;
  customColor?: string;
  providers?: [string];
  url?: string;
  apiUrl?: string;
  style: ViewStyle;
};

const ComponentName = "MetriportWidget";

const NativeWidget =
  UIManager.getViewManagerConfig(ComponentName) != null
    ? requireNativeComponent<MetriportWidgetProps>(ComponentName)
    : () => {
        throw new Error(LINKING_ERROR);
      };

export const MetriportWidget = (props: MetriportWidgetProps & WebViewProps) => {
  if (Platform.OS === "ios") {
    return <NativeWidget {...props} />;
  }

  const url = props.url ? props.url : "https://connect.metriport.com";

  return <WebView source={{ uri: `${url}?token=${props.token}` }} {...props} />;
};
