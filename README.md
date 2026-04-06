# Sistema de Préstamos - Asuntos Estudiantiles

Aplicación web para gestionar préstamos de artículos a estudiantes universitarios. Soporta múltiples sedes con roles de admin y operador.

## Stack

- Next.js 16 · React 19 · TypeScript
- PostgreSQL + Prisma 7 (`@prisma/adapter-pg`)
- NextAuth.js v5 (JWT)
- Upstash Redis (rate limiting)
- Tailwind CSS v4

---

## Despliegue a producción

### 1. Base de datos PostgreSQL

Necesitas una instancia PostgreSQL accesible desde internet. Opciones recomendadas: **Neon**, **Supabase**, o cualquier VPS con Postgres.

Una vez creada la base de datos, copia la connection string. Debe tener el formato:

```
postgres://usuario:contraseña@host:5432/nombre_db?sslmode=require
```

> Si usas Neon o Supabase, asegúrate de usar la connection string en modo **pooled** (puerto 6543 en Neon) para el `DATABASE_URL` de producción, ya que serverless necesita pooling.

---

### 2. Upstash Redis (rate limiting)

1. Entra a [upstash.com](https://upstash.com) y crea una cuenta gratuita.
2. Crea una nueva base de datos Redis (region más cercana a tu deployment).
3. En el panel de la base de datos, copia:
   - **REST URL** → `UPSTASH_REDIS_REST_URL`
   - **REST Token** → `UPSTASH_REDIS_REST_TOKEN`

---

### 3. Variables de entorno

Crea un archivo `.env.production` o configura las variables directamente en tu plataforma de hosting (Vercel, Railway, etc.):

```env
# Base de datos PostgreSQL
DATABASE_URL="postgres://usuario:contraseña@host:5432/nombre_db?sslmode=require"

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL="https://xxxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxxxxxxxxxxxxxxx"

# NextAuth - genera un secreto aleatorio con: openssl rand -hex 32
AUTH_SECRET="tu_secreto_aleatorio_aqui"

# URL pública de la app (requerido por NextAuth en producción)
AUTH_URL="https://tu-dominio.com"
```

Para generar `AUTH_SECRET`:

```bash
openssl rand -hex 32
```

---

### 4. Migraciones de base de datos

Instala dependencias y aplica el schema a la base de datos de producción:

```bash
npm install

# Aplica las migraciones (crea las tablas)
npx prisma migrate deploy

# Genera el cliente Prisma
npx prisma generate
```

> `migrate deploy` aplica las migraciones pendientes sin modo interactivo. Úsalo siempre en producción (no `migrate dev`).

---

### 5. Seed inicial (primer deploy)

El script de seed crea las sedes, categorías, artículos de ejemplo y los usuarios de administración:

```bash
npx tsx scripts/seed-users.ts
```

**Credenciales creadas por el seed:**

| Usuario    | Contraseña    | Rol      |
|------------|---------------|----------|
| `admin`    | `admin123`    | Admin    |
| `operador` | `operador123` | Operador |

> Cambia estas contraseñas desde el panel `/admin` inmediatamente después del primer login.

---

### 6. Build y arranque

```bash
npm run build
npm start
```

---

### 7. Deploy en Vercel (recomendado)

1. Conecta el repositorio en [vercel.com](https://vercel.com).
2. Agrega las variables de entorno en **Settings > Environment Variables**:
   - `DATABASE_URL`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `AUTH_SECRET`
   - `AUTH_URL` (la URL de producción, ej: `https://prestamos.tuuniversidad.cl`)
3. En **Build & Deployment**, el build command por defecto (`next build`) ya incluye `prisma generate` si lo configuras así, o agrégalo manualmente:
   ```
   npx prisma generate && next build
   ```
4. Despliega. Las migraciones (`prisma migrate deploy`) córrelas manualmente una vez conectando a la DB de producción desde tu máquina local con el `DATABASE_URL` de producción en el entorno.

---

### 8. Deploy en Railway / Render / VPS

En Railway o Render, la configuración es similar:

1. Agrega las variables de entorno en el panel de la plataforma.
2. Configura el **build command**:
   ```bash
   npx prisma generate && npm run build
   ```
3. Configura el **start command**:
   ```bash
   npx prisma migrate deploy && npm start
   ```

En un VPS con PM2:

```bash
# Instalar dependencias
npm ci

# Aplicar migraciones
DATABASE_URL="..." npx prisma migrate deploy

# Generar cliente
npx prisma generate

# Build
npm run build

# Arrancar con PM2
pm2 start npm --name "prestamos" -- start
pm2 save
```

---

## Variables de entorno — resumen

| Variable | Descripción | Obligatoria |
|---|---|---|
| `DATABASE_URL` | Connection string de PostgreSQL | Sí |
| `UPSTASH_REDIS_REST_URL` | URL REST de Upstash Redis | Sí |
| `UPSTASH_REDIS_REST_TOKEN` | Token REST de Upstash Redis | Sí |
| `AUTH_SECRET` | Secreto para firmar JWTs de NextAuth | Sí |
| `AUTH_URL` | URL pública de la app (NextAuth) | Sí en producción |

---

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Generar cliente Prisma
npx prisma generate

# Aplicar schema a la DB local
npx prisma migrate dev

# (Opcional) Cargar datos de prueba
npx tsx scripts/seed-users.ts

# Arrancar servidor de desarrollo
npm run dev
```

El `.env` local solo necesita `DATABASE_URL`, `AUTH_SECRET`, y `UPSTASH_*` si quieres probar el rate limiting. Sin Upstash configurado, las rutas con rate limit fallarán — puedes comentar temporalmente las llamadas en `lib/rate-limit.ts` para desarrollo sin Redis.
