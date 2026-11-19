# API REST de Libros en AWS (EC2 + RDS) con CI/CD en GitHub Actions

**Asignatura:** Trabajando en la Nube (COM610) — Universidad San Francisco Xavier de Chuquisaca  
**Estudiante:** Alexander Rodrigo Pinedo Cayo (`apinedo`)  
**Semestre:** 2/2026

---

## Enlaces de Entrega y Verificación

- **URL pública de la API:** http://13.58.227.103 (`http://13.58.227.103/health`, `http://13.58.227.103/libros`)
- **Workflow de CI exitoso:** `PENDIENTE_EJECUCION_CI`
- **Workflow de CD exitoso:** `PENDIENTE_EJECUCION_CD`

---

## Arquitectura e Infraestructura en AWS

La infraestructura se despliega en la región **US East (Ohio) — `us-east-2`** dentro de la misma VPC:

| Recurso | Identificador / Nombre | Configuración de Seguridad |
|---|---|---|
| **Instancia EC2** | `ec2-libros-apinedo` (`i-02496a9acee5c1567`) | Ubuntu 24.04 LTS, Elastic IP `13.58.227.103`, Nginx en puerto 80 como proxy inverso hacia `127.0.0.1:3000` |
| **Base de datos RDS** | `rds-libros-apinedo` | MariaDB `11.8.9` (`db.t3.micro`) con **acceso público deshabilitado** (`PubliclyAccessible: false`) |
| **Security Group EC2** | `ec2-libros-apinedo-sg` (`sg-0fc36a0c852d1bcde`) | Entrada: `22/TCP` solo desde IP pública autorizada; `80/TCP` desde `0.0.0.0/0` (`::/0`). Sin puertos `3000` ni `3306` expuestos |
| **Security Group RDS** | `rds-libros-apinedo-sg` (`sg-03ec3f7c8a00bfac0`) | Entrada: `3306/TCP` únicamente desde `ec2-libros-apinedo-sg` |

---

## Endpoints de la API

| Método y ruta | Comportamiento |
|---|---|
| `GET /health` | Devuelve `200` con el estado del servicio, nombre y versión |
| `GET /libros` | Lista todos los libros persistidos en RDS |
| `GET /libros/:id` | Devuelve un libro por ID (`404` si no existe, `400` si ID inválido) |
| `POST /libros` | Crea un libro validando `titulo`, `autor` y `anio_publicacion` entero (`201` o `400`) |
| `PUT /libros/:id` | Actualiza un libro existente (`200`, `400` si inválido o `404` si no existe) |
| `DELETE /libros/:id` | Elimina un libro existente (`200`, `400` si inválido o `404` si no existe) |

---

## Ejecución Local y Pruebas Automatizadas

### 1. Instalar dependencias y ejecutar pruebas (sin RDS)

Las pruebas usan **Jest** y **Supertest** con un repositorio en memoria (`createFakeLibrosRepository`) que reemplaza la capa de acceso a datos sin requerir conexión a RDS:

```bash
npm ci
npm test
```

### 2. Ejecutar localmente con base de datos

Copia `.env.example` a `.env` y completa las credenciales de tu base de datos local o túnel privado, aplica `db.sql` e inicia el servidor:

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
  -e DB_PASSWORD=ejemplo \
  -e DB_NAME=db_libros \
  api-libros-apinedo:local

curl -i http://127.0.0.1:3000/health
docker rm -f api-libros-local
```

---

## Pipeline de CI/CD con GitHub Actions

1. **CI (`.github/workflows/ci.yml`):** se ejecuta en cada `push` y `pull_request` hacia `main`. Ejecuta `npm ci` y `npm test` y falla ante cualquier prueba rota.
2. **CD (`.github/workflows/cd.yml`):** se ejecuta únicamente en `push` a `main` (un `pull_request` nunca despliega):
   - `test`: ejecuta `npm ci` y `npm test`.
   - `build-and-push`: construye la imagen Docker y la publica en `ghcr.io` etiquetada con `${{ github.sha }}` y `latest`.
   - `deploy`: abre temporalmente el puerto 22 en `ec2-libros-apinedo-sg` para la IP del runner, valida la nueva imagen en `127.0.0.1:3001` probando `/health` y `/libros` usando `/opt/api-libros/.env` (fuera del repositorio y de la imagen), promueve el contenedor a `127.0.0.1:3000` detrás de Nginx si pasa, conserva/restaura la versión anterior si falla y cierra el puerto 22 al finalizar.

### Secrets requeridos en GitHub Actions

- `REGISTRY_USERNAME` / `REGISTRY_TOKEN`
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `EC2_SECURITY_GROUP_ID`
- `EC2_HOST` / `EC2_USER` / `EC2_SSH_KEY`

---

## Verificación del Despliegue

```bash
# Salud del servicio
curl -i http://URL_PUBLICA/health

# Operaciones CRUD
curl -s -X POST http://URL_PUBLICA/libros \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Ingeniería en la Nube","autor":"Autor Ejemplo","anio_publicacion":2026}'

curl -s http://URL_PUBLICA/libros
curl -s -X PUT http://URL_PUBLICA/libros/1 \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Ingeniería en la Nube (2da Ed.)","autor":"Autor Ejemplo","anio_publicacion":2026}'
curl -s -X DELETE http://URL_PUBLICA/libros/1
```

---

## Evidencias

Las capturas solicitadas se encuentran en la carpeta [`evidencias/`](./evidencias/).
