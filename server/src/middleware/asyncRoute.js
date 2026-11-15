// Express 5 forwards rejected async route promises to the error middleware.
// This wrapper also makes that behavior obvious at each route declaration.
export const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
