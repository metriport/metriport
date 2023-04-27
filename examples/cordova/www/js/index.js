// Wait for the deviceready event before using any of Cordova's device APIs.
// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready
document.addEventListener("deviceready", onDeviceReady, false);

function onDeviceReady() {
  document.getElementById("deviceready").classList.add("ready");
}

document.getElementById("show").addEventListener("click", () =>
  metriportconnectwidget.show({
    clientApiKey: "CLIENT_API_KEY",
    token: "CONNECT_TOKEN",
  })
);
