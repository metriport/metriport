export default class Constants {
  static TOKEN_PARAM = "token";
  static SANDBOX_PARAM = "sandbox";
  static STAGING_PARAM = "staging";
  static CLOUD_ENV = "production"; // NODE_ENV is production when not local
  static COLOR_MODE_PARAM = "colorMode";
  static CUSTOM_COLOR_PARAM = "customColor";
  static PROVIDERS_PARAM = "providers";
  static APPLE_PARAM = "apple";
  static BREAKPOINTS = {
    xs: "300px",
    sm: "500px",
    md: "768px",
    lg: "960px",
    xl: "1200px",
    "2xl": "1536px",
  };
  static PRIMARY_COLOR = "#748df0";
  static HOVER_COLOR = "#879ced";
}
