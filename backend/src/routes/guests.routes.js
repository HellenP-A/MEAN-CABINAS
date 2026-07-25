const express = require('express');
const { Guest } = require('../models');

const router = express.Router();

// Busqueda por cedula o nombre: /api/guests?search=1-1234
router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    const filter = search
      ? { $or: [{ idNumber: new RegExp(search, 'i') }, { fullName: new RegExp(search, 'i') }] }
      : {};
    res.json(await Guest.find(filter).sort({ fullName: 1 }).limit(50));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await Guest.create(req.body));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Ya existe un huesped con esa cedula' });
    }
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const guest = await Guest.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!guest) return res.status(404).json({ message: 'El huesped no existe' });
    res.json(guest);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
