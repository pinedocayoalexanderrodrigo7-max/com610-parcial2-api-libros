/**
 * Data access layer for the `libros` table using parameterized SQL queries.
 */
function createLibrosRepository(pool) {
  return {
    async findAll() {
      const [rows] = await pool.execute(
        'SELECT id, titulo, autor, anio_publicacion FROM libros ORDER BY id ASC'
      );
      return rows;
    },

    async findById(id) {
      const [rows] = await pool.execute(
        'SELECT id, titulo, autor, anio_publicacion FROM libros WHERE id = ?',
        [id]
      );
      return rows[0] || null;
    },

    async create({ titulo, autor, anio_publicacion }) {
      const [result] = await pool.execute(
        'INSERT INTO libros (titulo, autor, anio_publicacion) VALUES (?, ?, ?)',
        [titulo, autor, anio_publicacion]
      );
      return {
        id: result.insertId,
        titulo,
        autor,
        anio_publicacion
      };
    },

    async update(id, { titulo, autor, anio_publicacion }) {
      const [result] = await pool.execute(
        'UPDATE libros SET titulo = ?, autor = ?, anio_publicacion = ? WHERE id = ?',
        [titulo, autor, anio_publicacion, id]
      );
      if (result.affectedRows === 0) {
        return null;
      }
      return {
        id,
        titulo,
        autor,
        anio_publicacion
      };
    },

    async remove(id) {
      const [result] = await pool.execute(
        'DELETE FROM libros WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    }
  };
}

module.exports = { createLibrosRepository };
