export class AppError extends Error {
  /**
   * @param {string} code machine-readable code, E_UPPER_SNAKE
   * @param {string} message human-readable message
   */
  constructor(code, message) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}
