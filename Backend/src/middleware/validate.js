/**
 * Zod-backed request validation. Controllers can then trust their inputs
 * completely — no defensive parsing further down the stack.
 */
import { UnprocessableEntity } from '../lib/errors.js';

const format = (error) =>
  error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
    code: issue.code,
  }));

export const validate = (schemas) => (req, _res, next) => {
  try {
    for (const source of ['body', 'query', 'params']) {
      if (!schemas[source]) continue;
      const result = schemas[source].safeParse(req[source]);
      if (!result.success) {
        return next(UnprocessableEntity('Some fields need your attention.', format(result.error)));
      }
      // Express 5 makes req.query a getter; assign onto a validated bag instead.
      if (source === 'query') req.validatedQuery = result.data;
      else req[source] = result.data;
    }
    next();
  } catch (error) {
    next(error);
  }
};
