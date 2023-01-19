# Metriport-IOS

A Swift Library for access to Apple Healthkit.

## Installation

To add a package dependency to your Xcode project, select File > Swift Packages > Add Package Dependency and enter (ONCE MERGED ILL CREATE ANOTHER PR AND ADD THE ACTUAL LINK HERE). For more reference visit apple's [docs here.](https://developer.apple.com/documentation/xcode/adding-package-dependencies-to-your-app)

#### Setup

`ENVIRONMENT_URL` is optional and defaults to https://api.metriport.com. For
sandbox mode add https://api.sandbox.metriport.com.

Add this snippet to the root of your project.

```
import MetriportSDK

var healthStore = MetriportHealthStoreManager(clientApiKey: "CLIENT_API_KEY", "ENVIRONMENT_URL");
```

Inside of a view you can add the `MetriportWidget` to be able to access the providers.

```
var body: some View {
    VStack {
        Button {
            webviewController.getToken()
        } label: {
            Text("Metriport Widget")
        }
        .sheet(isPresented: $webviewController.showWebView) {
            MetriportWidget(url: "\(WIDGET_URL)/?token=\("TOKEN")&colorMode=dark", healthStore: healthStore)
        }
    }
    .padding()
}
```

```
            ,▄,
          ▄▓███▌
      ▄▀╙   ▀▓▀    ²▄
    ▄└               ╙▌
  ,▀                   ╨▄
  ▌                     ║
                         ▌
                         ▌
,▓██▄                 ╔███▄
╙███▌                 ▀███▀
    ▀▄
      ▀╗▄         ,▄
         '╙▀▀▀▀▀╙''


      by Metriport Inc.

```
