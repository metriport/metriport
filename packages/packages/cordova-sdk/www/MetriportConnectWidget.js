var exec = require("cordova/exec");

exports.show = function ({
  clientApiKey,
  token,
  sandbox,
  apiUrl,
  colorMode,
  customColor,
  providers,
  url
}) {
  if (window.cordova.platformId === "ios") {
    exec(null, null, "MetriportConnectWidget", "show", [
      clientApiKey,
      token,
      sandbox,
      apiUrl,
      colorMode,
      customColor,
      providers,
      url
    ]);
  } else {
    let customUrl = url ? url : "https://connect.metriport.com";

    customUrl = `${customUrl}?token=${token}`;

    if (sandbox) {
      customUrl = `${customUrl}&sandbox=true`;
    }

    if (colorMode) {
      customUrl = `${customUrl}&colorMode=${colorMode}`;
    }

    if (customColor) {
      customUrl = `${customUrl}&customColor=${customColor}`;
    }

    if (providers) {
      const providersStr = providers.join();
      customUrl = `${url}&providers=${providersStr}`;
    }

    cordova.InAppBrowser.open(customUrl, "_blank", "location=yes");
  }
};
