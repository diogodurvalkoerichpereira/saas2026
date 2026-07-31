const router = require('express').Router();
const { z } = require('zod');
const { authenticate } = require('./auth.service');
const { loginRateLimit } = require('../../middlewares/login-rate-limit');

const credentials = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    const result = await authenticate(credentials.parse(req.body));
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) error.status = 400;
    next(error);
  }
});

module.exports = router;
