const router = require('express').Router();
const { pool } = require('../../config/database');

router.get('/', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    next(Object.assign(new Error('Banco de dados indisponível.'), { status: 503, cause: error }));
  }
});

module.exports = router;
