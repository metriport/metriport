import status from 'http-status';

export default abstract class MetriportError extends Error {
  status: number = status.INTERNAL_SERVER_ERROR;
  constructor(message: string) {
    super(message);
  }
}
