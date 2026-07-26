const express = require('express');
const { login } = require('../services/authService');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    res.json(await login(req.body.username, req.body.password));
  } catch (error) {
    next(error);
  }
});

/** Permite al frontend saber si la sesion sigue viva al recargar. */
router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username, role: req.user.role });
});

module.exports = router;
