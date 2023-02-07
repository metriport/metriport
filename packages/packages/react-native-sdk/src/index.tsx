import { requireNativeComponent, UIManager, Platform, ViewStyle } from "react-native";

const LINKING_ERROR =
  `The package 'metriport-react-native' doesn't seem to be linked. Make sure: \n\n` +
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

export const MetriportWidget =
  UIManager.getViewManagerConfig(ComponentName) != null
    ? requireNativeComponent<MetriportWidgetProps>(ComponentName)
    : () => {
        throw new Error(LINKING_ERROR);
      };
