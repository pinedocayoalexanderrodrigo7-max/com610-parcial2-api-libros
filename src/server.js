require('dotenv').config();

const { createPool } = require('./db');
const { createLibrosRepository } = require('./librosRepository');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT || 3000);
const pool = createPool();
const repository = createLibrosRepository(pool);
const app = createApp(repository);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`API de libros escuchando en http://0.0.0.0:${PORT}`);
});

async function shutdown(signal) {
  console.log(`Señal ${signal} recibida, cerrando servidor...`);
  server.close(async () => {
    try {
      await pool.end();
    } catch (err) {
      console.error('Error al cerrar el pool de base de datos:', err);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
