require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());
app.use(morgan('dev'));

// Estado del servicio: util para verificar que la API y la base responden
app.get('/api/health', (req, res) => {
  const states = ['desconectado', 'conectado', 'conectando', 'desconectando'];
  res.json({
    status: 'ok',
    database: states[mongoose.connection.readyState],
    databaseName: mongoose.connection.name
  });
});

app.use((req, res) => res.status(404).json({ message: 'Ruta no encontrada' }));

// Se conecta primero a la base; sin base no tiene sentido escuchar peticiones
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Conexion a MongoDB establecida');
    app.listen(port, '0.0.0.0', () => console.log(`API escuchando en el puerto ${port}`));
  })
  .catch((error) => {
    console.error('No fue posible conectar a la base de datos:', error.message);
    process.exit(1);
  });
