/**
 * HTTP helpers.
 *
 * All API responses follow a consistent shape:
 *   Success: { success: true, message?: string, data: any }
 *   Error:   { success: false, message: string, error?: string, details?: any }
 */

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const notFound = (req, res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const payload = {
    success: false,
    message: err.message || 'Internal server error',
  };
  if (err.details) payload.details = err.details;
  if (process.env.NODE_ENV !== 'production' && status >= 500) {
    payload.error = err.stack;
  }
  if (status >= 500) {
    console.error('[error]', err);
  }
  res.status(status).json(payload);
};

const send = (res, data = null, message = null, status = 200) => {
  const payload = { success: true, data };
  if (message) payload.message = message;
  res.status(status).json(payload);
};

const sendOk       = (res, data, message = 'OK')                      => send(res, data, message, 200);
const sendCreated  = (res, data, message = 'Created')                 => send(res, data, message, 201);
const sendAccepted = (res, data, message = 'Accepted')                => send(res, data, message, 202);
const sendNoContent = (res, message = 'No Content')                    => send(res, null, message, 204);

module.exports = {
  HttpError,
  asyncHandler,
  notFound,
  errorHandler,
  sendOk,
  sendCreated,
  sendAccepted,
  sendNoContent,
  send,
};
