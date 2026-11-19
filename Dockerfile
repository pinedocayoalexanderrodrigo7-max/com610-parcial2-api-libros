# Etapa 1: Instalación de dependencias de producción
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Etapa 2: Imagen final liviana sin herramientas de build ni devDependencies
FROM node:20-alpine
LABEL org.opencontainers.image.source="https://github.com/pinedocayoalexanderrodrigo7-max/com610-parcial2-api-libros"
LABEL org.opencontainers.image.description="API REST de catálogo de libros en EC2 y RDS (COM610)"
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
