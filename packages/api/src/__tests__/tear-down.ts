module.exports = async function () {
  /**
   * Had to add this to force close Jest after all tests are done.
   * It was hanging after E2E tests were done because of Ngrok - output:
   * > Jest has detected the following 1 open handle potentially keeping Jest from exiting:
   * >   ●  CustomGC
   * >     > 1 | import ngrok, { Session } from "@ngrok/ngrok";
   */
  process.exit(0);
};
