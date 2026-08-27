import readline from "readline";

/**
 * Prompts the user for confirmation before proceeding with an action.
 * Exits the process if the user does not confirm.
 *
 * @param message - The message to display to the user
 * @param log - Optional logger function (defaults to console.log)
 */
export async function confirm(message: string, log = console.log): Promise<void> {
  log(message);
  log("Are you sure you want to proceed?");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question("Type 'yes' to proceed: ", answer => {
      if (answer !== "yes") {
        log("Aborting...");
        process.exit(0);
      }
      rl.close();
      resolve();
    });
  });
}
