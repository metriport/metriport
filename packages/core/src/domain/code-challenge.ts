export interface CodeChallenge {
  getCode(): Promise<string>;
}

export class CodeChallengeFromSecretManager implements CodeChallenge {
  constructor(private readonly secretName: string) {}

  async getCode(): Promise<string> {
    // get code from secret manager
    // notify Slack
    // sleep
    // get code from secret manager
    // if the same, sleep and try again
    // if different, return code

    // TODO implement this
    // TODO implement this
    // TODO implement this
    // TODO implement this
    // TODO implement this
    return "123456";
  }
}
