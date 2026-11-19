# API REST de Libros en AWS (EC2 + RDS) con CI/CD en GitHub Actions

**Asignatura:** Trabajando en la Nube (COM610) — Universidad San Francisco Xavier de Chuquisaca  
**Docente:** Ing. Marcelo Quispe Ortega  
**Estudiante:** Alexander Rodrigo Pinedo Cayo (`apinedo`)  
**Semestre:** 2/2026

---

## Enlaces de Entrega y Verificación

- **URL pública de la API:** http://13.58.227.103
  - Salud (`GET /health`): http://13.58.227.103/health
  - Catálogo (`GET /libros`): http://13.58.227.103/libros
- **Ejecución exitosa de CI (`v1.1.0`):** https://github.com/pinedocayoalexanderrodrigo7-max/com610-parcial2-api-libros/actions/runs/44624785103
- **Ejecución exitosa de CD (`v1.1.0`):** https://github.com/pinedocayoalexanderrodrigo7-max/com610-parcial2-api-libros/actions/runs/44624785227
- **Pull Request #1 (ejecuta solo CI, sin despliegue CD):** https://github.com/pinedocayoalexanderrodrigo7-max/com610-parcial2-api-libros/pull/1 ([CI Run](https://github.com/pinedocayoalexanderrodrigo7-max/com610-parcial2-api-libros/actions/runs/44624649821))
- **Demostración de protección ante fallo de healthcheck (falla CD y conserva `v1.1.0`):** https://github.com/pinedocayoalexanderrodrigo7-max/com610-parcial2-api-libros/actions/runs/44625358791
- **Recuperación posterior exitosa:** [CI Run](https://github.com/pinedocayoalexanderrodrigo7-max/com610-parcial2-api-libros/actions/runs/44625552838) | [CD Run](https://github.com/pinedocayoalexanderrodrigo7-max/com610-parcial2-api-libros/actions/runs/44625552818)

---

## Arquitectura e Infraestructura en AWS

Todos los recursos se desplegaron en la región **US East (Ohio) — `us-east-2`** dentro de la misma **VPC** (`vpc-0ca151cf9c1e4f06d`):

| Recurso | Identificador / Nombre | Configuración de Seguridad y Red |
|---|---|---|
| **Instancia EC2** | `ec2-libros-apinedo` (`i-02496a9acee5c1567`) | Ubuntu 24.04 LTS (`t3.micro`), Elastic IP pública `13.58.227.103`, Docker Engine y Nginx en puerto `80` como proxy inverso hacia `127.0.0.1:3000` |
| **Base de datos RDS** | `rds-libros-apinedo` | Amazon RDS for MariaDB `11.8.9` (`db.t3.micro`), base `db_libros`, **acceso público deshabilitado** (`PubliclyAccessible: false`) |
| **Security Group EC2** | `ec2-libros-apinedo-sg` (`sg-0fc36a0c852d1bcde`) | Entrada: `22/TCP` únicamente desde la IP pública autorizada; `80/TCP` desde `0.0.0.0/0` y `::/0`. Los puertos `3000` y `3306` **no** están expuestos a Internet |
| **Security Group RDS** | `rds-libros-apinedo-sg` (`sg-03ec3f7c8a00bfac0`) | Entrada: `3306/TCP` únicamente desde `ec2-libros-apinedo-sg` (`sg-0fc36a0c852d1bcde`) |
| **Usuario IAM para CD** | `gha-deploy-libros-apinedo` | Permisos mínimos para autorizar y revocar temporalmente `22/TCP` al runner de GitHub Actions en `ec2-libros-apinedo-sg` |

---

## Modelo SQL y Endpoints de la API

El esquema SQL se define en [`db.sql`](./db.sql) y crea la tabla `libros` (`id`, `titulo`, `autor`, `anio_publicacion`) en MariaDB. Todas las operaciones utilizan consultas parametrizadas con `mysql2/promise` (`?`) y conexión TLS hacia RDS (`ssl: 'Amazon RDS'`).

| Método y ruta | Comportamiento y validaciones |
|---|---|
| `GET /health` | Devuelve `200` con `{ status: "ok", service, version, message, timestamp }` |
| `GET /libros` | Devuelve `200` con la lista de libros almacenados en Amazon RDS |
| `GET /libros/:id` | Devuelve `200` con el libro; `404` si no existe; `400` si el ID no es entero positivo |
| `POST /libros` | Valida `titulo` y `autor` no vacíos y `anio_publicacion` entero válido (`400` si inválido; `201` con el libro creado) |
| `PUT /libros/:id` | Valida ID y cuerpo (`400` si inválido; `404` si no existe; `200` con el registro actualizado) |
| `DELETE /libros/:id` | Elimina el libro en RDS (`400` si ID inválido; `404` si no existe; `200` si se eliminó) |

---

## Ejecución Local y Pruebas Automatizadas

### 1. Instalar dependencias y ejecutar pruebas (sin RDS real)

Las pruebas automatizadas usan **Jest** y **Supertest** con un doble de prueba en memoria (`createFakeLibrosRepository` en [`tests/libros.test.js`](./tests/libros.test.js)), permitiendo validar todos los endpoints y reglas sin depender de una instancia RDS activa:

```bash
npm ci
npm test
```

### 2. Ejecutar la aplicación con variables de entorno

Copia [`.env.example`](./.env.example) a `.env` (excluido en `.gitignore`), aplica [`db.sql`](./db.sql) en tu instancia MariaDB/MySQL e inicia el servidor:

```bash
cp .env.example .env
npm start
```

### 3. Construcción y prueba local con Docker

```bash
docker build -t api-libros-apinedo:local .

docker run -d --name api-libros-local \
  -p 127.0.0.1:3000:3000 \
  -e PORT=3000 \
  -e DB_HOST=127.0.0.1 \
  -e DB_PORT=3306 \
  -e DB_USER=usr_libros \
  -e DB_PASSWORD=valor_ficticio \
  -e DB_NAME=db_libros \
  -e DB_SSL=false \
  api-libros-apinedo:local

curl -i http://127.0.0.1:3000/health
docker rm -f api-libros-local
```

---

## Pipeline de CI/CD con GitHub Actions

1. **Integración Continua ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)):**
   - Se ejecuta en cada `push` y `pull_request` hacia `main`.
   - Ejecuta `npm ci` y `npm test`; cualquier prueba fallida marca la ejecución como fallida.
2. **Despliegue Continuo ([`.github/workflows/cd.yml`](./.github/workflows/cd.yml)):**
   - Se ejecuta únicamente ante eventos `push` en `main` (un `pull_request` no dispara despliegue).
   - Trabajos dependientes en orden:
     1. `test`: ejecuta `npm ci` y `npm test`.
     2. `build-and-push` (`needs: test`): construye la imagen Docker multi-stage y la publica en GitHub Container Registry (`ghcr.io`) etiquetada con `${{ github.sha }}` y `latest`.
     3. `deploy` (`needs: build-and-push`): abre temporalmente SSH (`22/TCP`) únicamente para la IP del runner, valida la nueva imagen en `127.0.0.1:3001` usando `/opt/api-libros/.env` (almacenado únicamente en EC2, fuera del repositorio y de la imagen) comprobando `/health` y `/libros`; si pasa, reemplaza el contenedor en `127.0.0.1:3000` detrás de Nginx y vuelve a verificar ambos endpoints a través del puerto `80`. Si la nueva versión falla, el workflow falla y conserva/restaura el contenedor anterior. Finalmente cierra la regla SSH temporal (`if: always()`).

### Secrets configurados en GitHub Actions

- `REGISTRY_USERNAME` / `REGISTRY_TOKEN`
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `EC2_SECURITY_GROUP_ID`
- `EC2_HOST` / `EC2_USER` / `EC2_SSH_KEY`

---

## Verificación del Despliegue y Rollback Manual

### Verificar la API desplegada desde el equipo local

```bash
# 1. Salud y versión desplegada
curl -i http://13.58.227.103/health

# 2. Crear libro
curl -i -X POST http://13.58.227.103/libros \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Redes y Nube","autor":"Autor Prueba","anio_publicacion":2026}'

# 3. Consultar libros
curl -i http://13.58.227.103/libros

# 4. Actualizar libro (reemplaza :id)
curl -i -X PUT http://13.58.227.103/libros/1 \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Cien años de soledad (Edición Conmemorativa)","autor":"Gabriel García Márquez","anio_publicacion":2007}'

# 5. Eliminar libro temporal
curl -i -X DELETE http://13.58.227.103/libros/3
```

### Rollback manual a un commit SHA anterior en EC2

Al publicar cada imagen etiquetada con `${{ github.sha }}` en `ghcr.io`, se puede revertir inmediatamente a cualquier versión previa desde EC2:

```bash
IMAGE_PREV="ghcr.io/pinedocayoalexanderrodrigo7-max/api-libros-apinedo:SHA_ANTERIOR"
docker pull "$IMAGE_PREV"
docker stop api-libros && docker rm api-libros
docker run -d --name api-libros --restart unless-stopped \
  -p 127.0.0.1:3000:3000 --env-file /opt/api-libros/.env "$IMAGE_PREV"
```

---

## Evidencias

Todas las capturas sanitizadas (sin claves, tokens ni Account ID expuesto) están almacenadas en [`evidencias/`](./evidencias/):

| Evidencia | Archivo |
|---|---|
| Instancia EC2, `ec2-libros-apinedo-sg` y Nginx en puerto 80 | [`01_ec2_y_security_group.png`](./evidencias/01_ec2_y_security_group.png) |
| Instancia RDS privada (`PubliclyAccessible: false`) y `rds-libros-apinedo-sg` (`3306` solo desde EC2) | [`02_rds_privado_y_security_group.png`](./evidencias/02_rds_privado_y_security_group.png) |
| Operaciones CRUD externas, validaciones `400`/`404`, puerto `3000` bloqueado y persistencia en RDS | [`03_crud_y_persistencia_rds.png`](./evidencias/03_crud_y_persistencia_rds.png) |
| Ejecución local de pruebas automatizadas Jest + Supertest (16/16 sin RDS) | [`04_pruebas_automatizadas_jest.png`](./evidencias/04_pruebas_automatizadas_jest.png) |
| Ejecución exitosa del workflow de CI en GitHub Actions | [`04b_github_actions_ci.png`](./evidencias/04b_github_actions_ci.png) |
| Imagen Docker publicada en GHCR con SHA y contenedor activo en EC2 | [`05_imagen_docker_publicada_ghcr.png`](./evidencias/05_imagen_docker_publicada_ghcr.png) |
| Ejecución exitosa del workflow de CD (Test → Build & Push → Deploy) | [`06_github_actions_cd_exitoso.png`](./evidencias/06_github_actions_cd_exitoso.png) |
| Fallo controlado de CD cuando `/health` falla | [`07_proteccion_fallo_healthcheck_cd.png`](./evidencias/07_proteccion_fallo_healthcheck_cd.png) |
| Respuesta visible `v1.1.0` en vivo y log de conservación de la versión anterior | [`07b_despliegue_v1_1_0_y_proteccion.png`](./evidencias/07b_despliegue_v1_1_0_y_proteccion.png) |
