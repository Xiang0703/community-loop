const { BadRequestError } = require('../utils/errors');

function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const msg = result.error.errors.map(e => e.message).join('; ');
      return next(new BadRequestError(msg));
    }
    req.validated = result.data;
    next();
  };
}

module.exports = { validate };
