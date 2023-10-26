import { CodeChallenge } from "@metriport/core/domain/code-challenge";
import * as readline from "readline-sync";

export class CodeChallengeFromTerminal implements CodeChallenge {
  async getCode() {
    return readline.question("What's the access code? ");
  }
}
