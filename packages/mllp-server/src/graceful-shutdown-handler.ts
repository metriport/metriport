import { Server, Socket } from "net";
import { onShutdown } from "node-graceful-shutdown";

interface GracefulShutdownOptions {
  /**
   * Force shutdown after timeout milliseconds
   * @default 30000
   */
  timeout?: number;
  onShutdown?: () => void;
}

interface ShutdownController {
  getConnections: () => number;
  isShuttingDown: () => boolean;
}

/**
 * Adds graceful shutdown capability to a TCP server
 * @param server - The TCP server instance
 * @param options - Configuration options
 * @returns Control methods for the shutdown process
 */
export function setGracefulShutdownHandler(
  server: Server,
  options: GracefulShutdownOptions = {}
): ShutdownController {
  // Default options
  const config = {
    timeout: options.timeout || 30000,
    onShutdown:
      options.onShutdown ||
      function noop() {
        return;
      },
  };

  // Track all active connections
  const connections = new Set<Socket>();
  let isShuttingDown = false;

  server.on("connection", (connection: Socket) => {
    connections.add(connection);
    connection.on("close", () => {
      connections.delete(connection);
    });

    if (isShuttingDown) {
      connection.end();
    }
  });

  const createServerClosedPromise = (): Promise<void> => {
    return new Promise<void>(resolve => {
      server.close(() => resolve());
    });
  };

  const waitForConnectionsToClose = async (timeout: number): Promise<void> => {
    // Actively signal to all existing connections that they should close
    for (const connection of connections) {
      connection.end();
    }

    const waitUntil = Date.now() + timeout;
    while (connections.size > 0 && Date.now() < waitUntil) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`[shutdown] Waiting, ${connections.size} connections remain`);
    }
  };

  const forceCloseRemainingConnections = (): void => {
    if (connections.size > 0) {
      console.log(`[shutdown] Forcing shutdown of ${connections.size} connections remain`);
      for (const connection of connections) {
        connection.destroy();
      }
    }
  };

  const handleOnShutdown = async (): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`[shutdown] Graceful shutdown initiated, ${connections.size} connections open`);

    const serverClosedPromise = createServerClosedPromise();
    await waitForConnectionsToClose(config.timeout);
    forceCloseRemainingConnections();

    await serverClosedPromise;
    await config.onShutdown();

    console.log("[shutdown] Graceful shutdown completed");
  };

  onShutdown(handleOnShutdown);

  return {
    getConnections: () => connections.size,
    isShuttingDown: () => isShuttingDown,
  };
}
