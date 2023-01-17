export default class Constants {
  static TOKEN_PARAM: string = "token";
  static SANDBOX_PARAM: string = "sandbox";
  static STAGING_PARAM: string = "staging";
  static CLOUD_ENV = "production"; // NODE_ENV is production when not local
  static COLOR_MODE_PARAM: string = "colorMode";
  static CUSTOM_COLOR_PARAM: string = "customColor";
  static PROVIDERS_PARAM: string = "providers";
  static APPLE_PARAM: string = "apple";
  static BREAKPOINTS: Object = {
    xs: "300px",
    sm: "500px",
    md: "768px",
    lg: "960px",
    xl: "1200px",
    "2xl": "1536px",
  };
  static PRIMARY_COLOR: string = "#748df0";
  static HOVER_COLOR: string = "#879ced";
}
