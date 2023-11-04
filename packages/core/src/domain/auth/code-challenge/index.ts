export interface CodeChallenge {
  getCode(): Promise<string>;
}
