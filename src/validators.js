/**
 * Validates and normalizes the request payload for creating or updating a libro.
 */
function validateLibroPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      valid: false,
      errors: ['El cuerpo de la solicitud debe ser un objeto JSON válido'],
      data: null
    };
  }

  const errors = [];
  const rawTitulo = body.titulo;
  const rawAutor = body.autor;
  const rawAnio = body.anio_publicacion;

  let titulo = '';
  if (typeof rawTitulo !== 'string' || rawTitulo.trim().length === 0) {
    errors.push('El campo "titulo" es obligatorio y no puede estar vacío');
  } else {
    titulo = rawTitulo.trim();
    if (titulo.length > 255) {
      errors.push('El campo "titulo" no puede exceder 255 caracteres');
    }
  }

  let autor = '';
  if (typeof rawAutor !== 'string' || rawAutor.trim().length === 0) {
    errors.push('El campo "autor" es obligatorio y no puede estar vacío');
  } else {
    autor = rawAutor.trim();
    if (autor.length > 255) {
      errors.push('El campo "autor" no puede exceder 255 caracteres');
    }
  }

  const maxAnio = new Date().getFullYear() + 1;
  if (typeof rawAnio !== 'number' || !Number.isInteger(rawAnio) || rawAnio < 1 || rawAnio > maxAnio) {
    errors.push(`El campo "anio_publicacion" debe ser un número entero válido entre 1 y ${maxAnio}`);
  }

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return {
    valid: true,
    errors: [],
    data: {
      titulo,
      autor,
      anio_publicacion: rawAnio
    }
  };
}

/**
 * Parses a route `:id` parameter and returns a positive safe integer or null.
 */
function parsePositiveIntId(rawId) {
  if (typeof rawId !== 'string' || !/^\d+$/.test(rawId)) {
    return null;
  }
  const id = Number(rawId);
  if (id <= 0 || !Number.isSafeInteger(id)) {
    return null;
  }
  return id;
}

module.exports = { validateLibroPayload, parsePositiveIntId };
