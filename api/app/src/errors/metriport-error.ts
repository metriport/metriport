import status from 'http-status';

export default abstract class MetriportError extends Error {
  status: Number = status.INTERNAL_SERVER_ERROR;
  constructor(message: string) {
    super(message);
  }
}
