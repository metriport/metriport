import axios, { AxiosInstance } from "axios";
import { createHash, randomBytes } from "crypto";
import { JwtTokenInfo, MetriportError, errorToString } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { createDataParams } from "../shared";
import { out } from "../../../util/log";

// Supported environments for ECW OAuth
const eclinicalworksEnv = ["sandbox", "prod"] as const;
export type EclinicalworksEnv = (typeof eclinicalworksEnv)[number];
export function isEclinicalworksEnv(env: string): env is EclinicalworksEnv {
  return eclinicalworksEnv.includes(env as EclinicalworksEnv);
}

export interface EclinicalworksApiConfig {
  clientId: string;
  clientSecret: string;
  environment: EclinicalworksEnv;
  // practiceId: string; /* Used for patient data & appts */
  redirectUri: string;
  twoLeggedAuthTokenInfo?: JwtTokenInfo | undefined;
}

// SMART on FHIR launch context
export interface LaunchContext {
  iss: string; // FHIR server base URL
  launch: string; // SMART launch token
}

// OAuth token response shape
export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
  patient?: string;
}

class EclinicalworksApi {
  // Two-legged auth token
  private twoLeggedAuthTokenInfo?: JwtTokenInfo | undefined;
  // private practiceId: string; /* Used for patient data & appts */

  // Axios instances for OAuth and FHIR
  private axiosInstanceFhir: AxiosInstance;
  // private axiosInstanceProprietary: AxiosInstance;

  // Base URLs and endpoints
  private baseUrl: string;
  private authorizeUrl: string;
  private tokenUrl: string;

  // PKCE parameters
  private codeVerifier?: string;
  private codeChallenge?: string;

  // SMART launch token
  private launchToken!: string;

  /**
   * Private constructor; use static `create` to instantiate.
   */
  private constructor(private config: EclinicalworksApiConfig) {
    this.twoLeggedAuthTokenInfo = config.twoLeggedAuthTokenInfo;
    // this.practiceId = config.practiceId!;

    // Determine host based on environment
    this.baseUrl =
      config.environment === "sandbox"
        ? "https://sandbox.oauthserver.eclinicalworks.com"
        : "https://oauthserver.eclinicalworks.com";

    this.authorizeUrl = `${this.baseUrl}/oauth/authorize`;
    this.tokenUrl = `${this.baseUrl}/oauth/token`;

    this.axiosInstanceFhir = axios.create({});
    /* Used for patient data & appts */
    // this.axiosInstanceProprietary = axios.create({});
  }

  public static async create(
    config: EclinicalworksApiConfig,
    launchCtx: LaunchContext
  ): Promise<EclinicalworksApi> {
    const instance = new EclinicalworksApi(config);
    await instance.initialize(launchCtx);
    return instance;
  }

  public getTwoLeggedAuthTokenInfo(): JwtTokenInfo {
    if (!this.twoLeggedAuthTokenInfo) {
      throw new MetriportError("Two-legged auth token not available");
    }
    return this.twoLeggedAuthTokenInfo;
  }

  private async fetchTwoLeggedAuthToken(): Promise<JwtTokenInfo> {
    try {
      const response = await axios.post(
        this.tokenUrl,
        createDataParams({
          grant_type: "client_credentials",
          scope: "openid",
        }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          auth: {
            username: this.config.clientId,
            password: this.config.clientSecret,
          },
        }
      );

      const tokenData = response.data;
      if (!response.data) throw new MetriportError("No body returned from token endpoint");
      return {
        access_token: tokenData.access_token,
        exp: new Date(Date.now() + tokenData.expires_in * 1000),
      };
    } catch (error) {
      throw new MetriportError("Failed to fetch Two-Legged Auth token", undefined, {
        error: errorToString(error),
      });
    }
  }

  /**
   * Initializes two-legged auth token and SMART PKCE flow.
   */
  private async initialize(launchCtx: LaunchContext): Promise<void> {
    const { log } = out(`Eclinicalworks initialize`);
    if (!this.twoLeggedAuthTokenInfo) {
      log(`Two Legged Auth token not found @ Eclinicalworks - fetching new token`);
      this.twoLeggedAuthTokenInfo = await this.fetchTwoLeggedAuthToken();
    } else if (this.twoLeggedAuthTokenInfo.exp < buildDayjs().add(15, "minutes").toDate()) {
      log(`Two Legged Auth token expired @ Eclinicalworks - fetching new token`);
      this.twoLeggedAuthTokenInfo = await this.fetchTwoLeggedAuthToken();
    }

    // Set OAuth headers for SMART and two-legged calls
    const headers = {
      Authorization: `Bearer ${this.twoLeggedAuthTokenInfo.access_token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    //baseURL: `${this.baseUrl}/fhir/r4`, Athena baseurl
    this.axiosInstanceFhir = axios.create({
      baseURL: `${this.baseUrl}/fhir/r4`,
      headers: { ...headers, accept: "application/json" },
    });

    /* Used for patient data & appts */
    // this.axiosInstanceProprietary = axios.create({
    //   baseURL: `${this.baseUrl}/v1/${this.practiceId}`,
    //   headers,
    // });

    // Generate PKCE for SMART launch
    const { codeVerifier, codeChallenge } = this.generatePkce();
    this.codeVerifier = codeVerifier;
    this.codeChallenge = codeChallenge;
    this.launchToken = launchCtx.launch;
  }

  /**
   * Constructs the SMART authorization URL with PKCE.
   */
  public getAuthorizationUrl(): string {
    if (!this.codeVerifier || !this.codeChallenge) {
      throw new Error("PKCE codes not set");
    }
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      launch: this.launchToken,
      scope: "launch openid fhirUser offline_access",
      aud: this.config.redirectUri,
      code_challenge: this.codeChallenge,
      code_challenge_method: "S256",
      state: randomBytes(16).toString("hex"),
    });
    return `${this.authorizeUrl}?${params}`;
  }

  /**
   * Exchanges an authorization code for SMART tokens.
   */
  public async exchangeAuthorizationCode(authCode: string): Promise<TokenResponse> {
    const response = await this.axiosInstanceFhir.post<TokenResponse>(
      "",
      createDataParams({
        grant_type: "authorization_code",
        code: authCode,
        redirect_uri: this.config.redirectUri,
        code_verifier: this.codeVerifier,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );
    this.storeTokens(response.data);
    return response.data;
  }

  /**
   * Logs current two-legged and SMART tokens (debug).
   */
  public printCurrentTokens(): void {
    console.log("Two-Legged Token:", this.twoLeggedAuthTokenInfo);
    console.log("SMART Access Token:", this.axiosInstanceFhir.defaults.headers?.Authorization);
  }

  /**
   * Persists SMART tokens and computes expiry.
   */
  private storeTokens(data: TokenResponse): void {
    if (this.axiosInstanceFhir.defaults.headers) {
      this.axiosInstanceFhir.defaults.headers.common = {
        ...this.axiosInstanceFhir.defaults.headers.common,
        Authorization: `Bearer ${data.access_token}`,
      };
    }
  }

  private generatePkce(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = randomBytes(64).toString("hex");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    return { codeVerifier, codeChallenge };
  }
}

export default EclinicalworksApi;
