@AGENTS.md
# Sistema de Préstamos - Asuntos Estudiantiles

## Qué es

Aplicación web para gestionar préstamos de artículos a estudiantes universitarios en el departamento de Asuntos Estudiantiles. Opera en múltiples sedes de forma independiente. No requiere instalación de software — corre en el navegador.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Base de datos:** PostgreSQL (via `@prisma/adapter-pg`)
- **ORM:** Prisma 7
- **Autenticación:** NextAuth.js v5 (beta, JWT strategy)
- **Estilos:** Tailwind CSS v4
- **Lenguaje:** TypeScript
- **Rate limiting:** Upstash Redis (`@upstash/ratelimit`)
- **QR scanning:** html5-qrcode (cámara)
- **QR generación:** react-qr-code, qrcode
- **Toasters:** Sileo https://sileo.aaryan.design/docs
- **Validación:** Zod 4

## Flujo principal

El sistema tiene dos interfaces separadas:

### Pantalla de kiosco (pública, sin navegación)
- Es lo que ven los estudiantes. No tiene menú, botones de navegación, ni forma de salir.
- Flujo: escanear QR de cédula → escanear QR del artículo → el sistema determina automáticamente si es préstamo o devolución según el estado actual del artículo.
- El QR de la cédula chilena es una URL del Registro Civil. El RUN se extrae del parámetro `RUN` de esa URL.
- Barrera de 5 minutos mínimo entre operaciones sobre el mismo artículo para evitar dobles escaneos accidentales.
- Si pasan más de 30 segundos entre el primer y segundo escaneo, se cancela y vuelve al inicio.
- Tras completar una operación, muestra confirmación y vuelve al estado inicial automáticamente.
- Rate limit: 20 scans/min por IP (Upstash).

### Panel de gestión (protegido con login)
- Solo accesible por operadores y administradores.
- Login de dos pasos para admins: credenciales → selector de sede (si tiene múltiples). Los operadores van directo.
- Contiene: préstamos activos, historial, inventario, dashboard de métricas, y gestión de sedes/usuarios.

## Roles

- **Admin:** Acceso global. Puede ver todas las sedes, crear sedes, crear usuarios, ver dashboard comparativo. Cambia de sede mediante cookie `viewSedeId` (endpoint `POST /api/sede/switch`). sedeId=null en DB.
- **Operador:** Acceso limitado a su sede asignada. Ve préstamos, historial e inventario de su sede únicamente.

## Contexto de sede (`lib/sede.ts`)

`resolveSedeContext()` resuelve el contexto activo para cada request:
- Operador: siempre su sedeId, `isGlobalView=false`.
- Admin sin cookie (o `viewSedeId=all`): `sedeId=null`, `isGlobalView=true` — vista comparativa de todas las sedes.
- Admin con cookie: sedeId específica, `isGlobalView=false`.

## Regla de negocio clave

Si un préstamo lleva más de 2 horas sin devolución, se considera vencido. El estado se evalúa en tiempo de consulta (no hay cron job — el umbral de 2h se calcula dinámicamente en las queries).

## Páginas

1. **`/kiosk`** — Pantalla de escaneo para estudiantes. Sin layout de gestión, sin navegación.
2. **`/login`** — Login de dos pasos (credenciales → selector de sede para admin con múltiples sedes).
3. **`/prestamos`** — Préstamos activos de la sede, con alerta visual en los vencidos. Devolución manual posible. Auto-polling cada 60s.
4. **`/historial`** — Préstamos pasados con filtros (fecha, RUN, artículo, estado) y métricas de período. Exportable a CSV.
5. **`/inventario`** — Artículos de la sede, agregar/editar artículos (individual o por lote), generar QR, gestionar categorías.
6. **`/dashboard`** — KPIs, gráficos (por día, categoría, hora), top artículos y alumnos. Vista comparativa entre sedes para admin.
7. **`/admin`** — Gestión de sedes y usuarios (solo admin). Server component + `admin-client.tsx` como Client Component.

## Modelo de datos (entidades principales)

- **Sede:** id, name, active, timestamps
- **User:** id, name, username (único), passwordHash, role (`ADMIN`|`OPERATOR`), sedeId (null para admins), active
- **Category:** id, name, sedeId, timestamps
- **Item:** id, internalCode (único), name, description, categoryId, sedeId, status (`AVAILABLE`|`LOANED`|`OUT_OF_SERVICE`), timestamps
- **Student:** id, run (único), name, timestamps (se crea en el primer escaneo)
- **Loan:** id, itemId, studentId, sedeId, loanDate, returnDate (null si activo), returnedOnTime (bool|null), returnMethod (`SCAN`|`MANUAL`)

## Rate limiting

- `loginLimiter`: 5 intentos / 60s por IP
- `kioskLimiter`: 20 scans / 60s por IP
- Implementado en `lib/rate-limit.ts` con Upstash Redis.

## Convenciones

- Usar App Router de Next.js (carpeta `app/`).
- Toda la UI en español.
- Nombres de variables y código en inglés.
- Componentes en PascalCase, archivos de componentes en kebab-case.
- Server Components por defecto. Client Components solo cuando se necesite interactividad.
- API routes en `app/api/`.
- Validación con Zod.
- Cada página tiene su propia carpeta con `page.tsx` y componentes locales si los necesita.

## Estructura de carpetas real

```
app/
  (kiosk)/
    kiosk/
      layout.tsx
      page.tsx
  (auth)/
    layout.tsx
    login/
      page.tsx
  (dashboard)/
    layout.tsx             ← sidebar/nav para todas las páginas de gestión
    dashboard/page.tsx
    prestamos/page.tsx
    historial/page.tsx
    inventario/page.tsx
    admin/
      page.tsx             ← server component (auth check)
      admin-client.tsx     ← client component con toda la UI de admin
  api/
    auth/login/route.ts
    auth/[...nextauth]/route.ts
    admin/
      users/route.ts
      users/[id]/route.ts
      sedes/route.ts
      sedes/[id]/route.ts
    sede/switch/route.ts
    inventory/
      items/route.ts
      items/[id]/route.ts
      items/[id]/toggle-service/route.ts
      categories/route.ts
      categories/[id]/route.ts
      distribution/route.ts
    loans/
      active/route.ts
      history/route.ts
      [id]/return/route.ts
    dashboard/metrics/route.ts
    kiosk/
      scan-student/route.ts
      scan-item/route.ts
prisma/
  schema.prisma
lib/
  auth.ts       ← NextAuth config, middleware, JWT callbacks
  db.ts         ← Prisma client singleton (PrismaPg adapter)
  rate-limit.ts ← Upstash rate limiters (login, kiosk)
  sede.ts       ← resolveSedeContext() helper
components/
  ui/
    filter-select.tsx
  dashboard/
    header.tsx
    sidebar.tsx
    logout-action.ts
types/
  next-auth.d.ts
scripts/
  seed-users.ts  ← 7 sedes, usuarios de prueba, artículos, préstamos
```

## Credenciales de prueba (seed)

- Admin: `admin` / `admin123`
- Operador: `operador` / `operador123`

## Notas importantes

- El QR de la cédula chilena tiene formato URL: `https://portal.nuevosidiv.registrocivil.cl/document-validity?RUN=XXXXXXXX-X&type=CEDULA&serial=...&mrz=...`. Solo necesitamos extraer el parámetro `RUN`.
- Los QR de artículos los generamos nosotros. El contenido del QR es el código interno del artículo.
- La pantalla de kiosco debe estar completamente aislada del panel de gestión. Sin navegación, sin acceso al layout de gestión.
- El sistema debe funcionar con lector QR USB (que actúa como teclado) o con cámara del dispositivo (html5-qrcode).
- Las páginas de admin en `/api/admin/` y `/admin` solo son accesibles con rol `ADMIN`. Las demás rutas protegidas aceptan `ADMIN` u `OPERATOR`.
- No hay cron jobs activos — el estado de vencido se calcula en cada query con el umbral de 2h.