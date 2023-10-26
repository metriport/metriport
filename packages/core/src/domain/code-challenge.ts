export interface CodeChallenge {
  getCode(): Promise<string>;
}

export class CodeChallengeFromSecretManager implements CodeChallenge {
  async getCode() {
    // get code from secret manager
    // notify Slack
    // sleep
    // get code from secret manager
    // if the same, sleep and try again
    // if different, return code
    return "123456";
  }
}
