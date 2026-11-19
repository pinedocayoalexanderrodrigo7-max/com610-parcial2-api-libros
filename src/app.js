const express = require('express');
const pkg = require('../package.json');
const { validateLibroPayload, parsePositiveIntId } = require('./validators');

/**
 * Creates the Express application with an injected repository so routes can be
 * tested cleanly without a live RDS instance.
 */
function createApp(repository) {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'api-libros-apinedo',
      version: pkg.version,
      message: 'API de libros desplegada automáticamente con CI/CD v1.1.0',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/libros', async (_req, res, next) => {
    try {
      const libros = await repository.findAll();
      res.status(200).json(libros);
    } catch (err) {
      next(err);
    }
  });

  app.get('/libros/:id', async (req, res, next) => {
    try {
      const id = parsePositiveIntId(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: 'ID de libro inválido' });
      }

      const libro = await repository.findById(id);
      if (!libro) {
        return res.status(404).json({ error: 'Libro no encontrado' });
      }

      return res.status(200).json(libro);
    } catch (err) {
      return next(err);
    }
  });

  app.post('/libros', async (req, res, next) => {
    try {
      const validation = validateLibroPayload(req.body);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Datos inválidos para el libro',
          detalles: validation.errors
        });
      }

      const nuevoLibro = await repository.create(validation.data);
      return res.status(201).json(nuevoLibro);
    } catch (err) {
      return next(err);
    }
  });

  app.put('/libros/:id', async (req, res, next) => {
    try {
      const id = parsePositiveIntId(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: 'ID de libro inválido' });
      }

      const validation = validateLibroPayload(req.body);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Datos inválidos para el libro',
          detalles: validation.errors
        });
      }

      const libroActualizado = await repository.update(id, validation.data);
      if (!libroActualizado) {
        return res.status(404).json({ error: 'Libro no encontrado' });
      }

      return res.status(200).json(libroActualizado);
    } catch (err) {
      return next(err);
    }
  });

  app.delete('/libros/:id', async (req, res, next) => {
    try {
      const id = parsePositiveIntId(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: 'ID de libro inválido' });
      }

      const eliminado = await repository.remove(id);
      if (!eliminado) {
        return res.status(404).json({ error: 'Libro no encontrado' });
      }

      return res.status(200).json({
        message: 'Libro eliminado correctamente',
        id
      });
    } catch (err) {
      return next(err);
    }
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  app.use((err, _req, res, _next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({ error: 'JSON inválido en el cuerpo de la solicitud' });
    }
    console.error('Error inesperado en la API:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

module.exports = { createApp };
