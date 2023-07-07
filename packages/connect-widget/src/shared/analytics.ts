import posthog from "posthog-js";

posthog.init(
  process.env.REACT_APP_PUBLIC_POST_HOG_KEY ? process.env.REACT_APP_PUBLIC_POST_HOG_KEY : "",
  {
    api_host: process.env.REACT_APP_PUBLIC_POST_HOG_HOST,
    autocapture: false,
    session_recording: {
      maskAllInputs: true,
    },
  }
);

class Analytics {
  static events = {
    acceptAgreement: "accept agreement",
    connectProvider: "connect provider",
    connectSuccess: "connect success",
  };

  static emit(eventName: string, properties?: object) {
    posthog.capture(eventName, {
      ...properties,
      platform: "connect-widget",
    });
  }

  static identify(id: string) {
    posthog.identify(id);
  }
}

export default Analytics;
