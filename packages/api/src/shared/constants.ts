import { ProviderSource } from "@metriport/api-sdk/devices/models/common/provider-source";
import { z } from "zod";
import { Apple } from "../providers/apple";
import { Cronometer } from "../providers/cronometer";
import { Dexcom } from "../providers/dexcom";
import { Fitbit } from "../providers/fitbit";
import { Garmin } from "../providers/garmin";
import { Google } from "../providers/google";
import { OAuth1 } from "../providers/shared/oauth1";
import { OAuth2 } from "../providers/shared/oauth2";
import { Oura } from "../providers/oura";
import Provider from "../providers/provider";
import { Whoop } from "../providers/whoop";
import { Withings } from "../providers/withings";
import { Tenovi } from "../providers/tenovi";

export const METRIPORT = "METRIPORT";
export const TEMPORARY = "TEMPORARY";

export const PROVIDER_APPLE = ProviderSource.apple;
export const PROVIDER_CRONOMETER = ProviderSource.cronometer;
export const PROVIDER_DEXCOM = ProviderSource.dexcom;
export const PROVIDER_OURA = ProviderSource.oura;
export const PROVIDER_GARMIN = ProviderSource.garmin;
export const PROVIDER_GOOGLE = ProviderSource.google;
export const PROVIDER_FITBIT = ProviderSource.fitbit;
export const PROVIDER_WHOOP = ProviderSource.whoop;
export const PROVIDER_WITHINGS = ProviderSource.withings;
export const PROVIDER_TENOVI = ProviderSource.tenovi;

export const rpmDeviceProviderSchema = z.enum([PROVIDER_TENOVI]);
export type RPMDeviceProviderOptions = z.infer<typeof rpmDeviceProviderSchema>;

export const providerOAuth1OptionsSchema = z.enum([PROVIDER_GARMIN]);
export type ProviderOAuth1Options = z.infer<typeof providerOAuth1OptionsSchema>;

export const providerOAuth2OptionsSchema = z.enum([
  PROVIDER_CRONOMETER,
  PROVIDER_DEXCOM,
  PROVIDER_OURA,
  PROVIDER_GOOGLE,
  PROVIDER_FITBIT,
  PROVIDER_WHOOP,
  PROVIDER_WITHINGS,
]);
export type ProviderOAuth2Options = z.infer<typeof providerOAuth2OptionsSchema>;

export const providerNoAuthSchema = z.enum([PROVIDER_APPLE, PROVIDER_TENOVI]);
export type ProviderNoAuthSchema = z.infer<typeof providerNoAuthSchema>;

export type ProviderOptions =
  | ProviderOAuth1Options
  | ProviderOAuth2Options
  | ProviderNoAuthSchema
  | RPMDeviceProviderOptions;

export class Constants {
  // the default time in seconds for which an auth token for a widget connect
  // session will be valid
  static readonly DEFAULT_TOKEN_EXPIRY_SECONDS: number = 600;

  static readonly PROVIDER_OAUTH1_MAP: {
    [k in ProviderOAuth1Options]: OAuth1;
  } = {
    garmin: new Garmin(),
  };

  static readonly noAuthProviders = {
    [PROVIDER_APPLE]: Apple,
    [PROVIDER_TENOVI]: Tenovi,
  };

  static readonly PROVIDER_OAUTH2_MAP: {
    [k in ProviderOAuth2Options]: OAuth2;
  } = {
    cronometer: new Cronometer(),
    dexcom: new Dexcom(),
    oura: new Oura(),
    google: new Google(),
    fitbit: new Fitbit(),
    whoop: new Whoop(),
    withings: new Withings(),
  };
  static readonly PROVIDER_MAP: { [k in ProviderOptions]: Provider } = {
    apple: new Apple(),
    cronometer: new Cronometer(),
    dexcom: new Dexcom(),
    oura: new Oura(),
    garmin: new Garmin(),
    google: new Google(),
    fitbit: new Fitbit(),
    tenovi: new Tenovi(),
    whoop: new Whoop(),
    withings: new Withings(),
  };
}
