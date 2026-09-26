export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'HttpError';
  }
}

export const httpError = (status, message, code) => new HttpError(status, message, code);