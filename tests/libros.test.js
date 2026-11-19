const request = require('supertest');
const { createApp } = require('../src/app');

/**
 * In-memory test double for the libros repository so unit/integration tests
 * run deterministically without requiring a real RDS instance.
 */
function createFakeLibrosRepository(initialItems = []) {
  let nextId = 1;
  let items = initialItems.map((item) => {
    const record = { id: nextId++, ...item };
    return record;
  });

  return {
    async findAll() {
      return items.map((item) => ({ ...item }));
    },

    async findById(id) {
      const found = items.find((item) => item.id === id);
      return found ? { ...found } : null;
    },

    async create({ titulo, autor, anio_publicacion }) {
      const record = { id: nextId++, titulo, autor, anio_publicacion };
      items.push(record);
      return { ...record };
    },

    async update(id, { titulo, autor, anio_publicacion }) {
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) {
        return null;
      }
      const updated = { id, titulo, autor, anio_publicacion };
      items[index] = updated;
      return { ...updated };
    },

    async remove(id) {
      const initialLength = items.length;
      items = items.filter((item) => item.id !== id);
      return items.length < initialLength;
    }
  };
}

describe('API REST de Libros (sin RDS)', () => {
  let app;

  beforeEach(() => {
    const fakeRepo = createFakeLibrosRepository([
      {
        titulo: 'Cien años de soledad',
        autor: 'Gabriel García Márquez',
        anio_publicacion: 1967
      },
      {
        titulo: 'Clean Code',
        autor: 'Robert C. Martin',
        anio_publicacion: 2008
      }
    ]);
    app = createApp(fakeRepo);
  });

  test('GET /health responde 200 con estado ok, servicio y versión', async () => {
    const res = await request(app).get('/health');

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('api-libros-apinedo');
    expect(res.body.version).toBe('1.1.0');
    expect(res.body.message).toContain('CI/CD v1.1.0');
    expect(res.body.timestamp).toBeDefined();
  });

  test('GET /libros devuelve la lista de libros almacenados', async () => {
    const res = await request(app).get('/libros');

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      id: 1,
      titulo: 'Cien años de soledad',
      autor: 'Gabriel García Márquez',
      anio_publicacion: 1967
    });
  });

  test('POST /libros crea un libro válido y devuelve 201 con campos normalizados', async () => {
    const res = await request(app)
      .post('/libros')
      .send({
        titulo: '  El Principito  ',
        autor: '  Antoine de Saint-Exupéry  ',
        anio_publicacion: 1943
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      id: 3,
      titulo: 'El Principito',
      autor: 'Antoine de Saint-Exupéry',
      anio_publicacion: 1943
    });

    const listRes = await request(app).get('/libros');
    expect(listRes.body).toHaveLength(3);
  });

  describe('POST /libros rechaza datos inválidos con 400', () => {
    test('rechaza titulo vacío o solo espacios', async () => {
      const res = await request(app)
        .post('/libros')
        .send({ titulo: '   ', autor: 'Autor válido', anio_publicacion: 2020 });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(Array.isArray(res.body.detalles)).toBe(true);
    });

    test('rechaza autor vacío o ausente', async () => {
      const res = await request(app)
        .post('/libros')
        .send({ titulo: 'Título válido', autor: '', anio_publicacion: 2020 });

      expect(res.statusCode).toBe(400);
      expect(res.body.detalles.length).toBeGreaterThan(0);
    });

    test.each([
      ['cadena numérica', '2020'],
      ['decimal', 2020.5],
      ['null', null],
      ['booleano', true],
      ['cero', 0],
      ['negativo', -1990],
      ['ausente', undefined]
    ])('rechaza anio_publicacion inválido (%s)', async (_label, invalidYear) => {
      const payload = { titulo: 'Libro', autor: 'Autor' };
      if (invalidYear !== undefined) {
        payload.anio_publicacion = invalidYear;
      }

      const res = await request(app).post('/libros').send(payload);
      expect(res.statusCode).toBe(400);
      expect(res.body.detalles.length).toBeGreaterThan(0);
    });

    test('rechaza payload vacío', async () => {
      const res = await request(app).post('/libros').send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.detalles).toHaveLength(3);
    });
  });

  test('GET /libros/:id devuelve 200 si existe, 404 si no existe y 400 si el ID es inválido', async () => {
    const okRes = await request(app).get('/libros/1');
    expect(okRes.statusCode).toBe(200);
    expect(okRes.body.titulo).toBe('Cien años de soledad');

    const notFoundRes = await request(app).get('/libros/9999');
    expect(notFoundRes.statusCode).toBe(404);
    expect(notFoundRes.body.error).toBeDefined();

    const invalidIdRes = await request(app).get('/libros/abc');
    expect(invalidIdRes.statusCode).toBe(400);
  });

  test('PUT /libros/:id actualiza un libro existente, devuelve 404 si no existe y 400 si es inválido', async () => {
    const updateRes = await request(app)
      .put('/libros/2')
      .send({
        titulo: 'Clean Code (2nd Edition)',
        autor: 'Robert C. Martin',
        anio_publicacion: 2021
      });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body).toEqual({
      id: 2,
      titulo: 'Clean Code (2nd Edition)',
      autor: 'Robert C. Martin',
      anio_publicacion: 2021
    });

    const checkRes = await request(app).get('/libros/2');
    expect(checkRes.body.anio_publicacion).toBe(2021);

    const notFoundRes = await request(app)
      .put('/libros/9999')
      .send({ titulo: 'X', autor: 'Y', anio_publicacion: 2000 });
    expect(notFoundRes.statusCode).toBe(404);

    const invalidRes = await request(app)
      .put('/libros/2')
      .send({ titulo: '', autor: 'Autor', anio_publicacion: 'no-int' });
    expect(invalidRes.statusCode).toBe(400);
  });

  test('DELETE /libros/:id elimina un libro existente y devuelve 404 si no existe', async () => {
    const deleteRes = await request(app).delete('/libros/1');
    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.body.id).toBe(1);

    const afterDeleteRes = await request(app).get('/libros/1');
    expect(afterDeleteRes.statusCode).toBe(404);

    const notFoundRes = await request(app).delete('/libros/9999');
    expect(notFoundRes.statusCode).toBe(404);
  });
});
