@AGENTS.md
# Sistema de Préstamos - Asuntos Estudiantiles

## Qué es

Aplicación web para gestionar préstamos de artículos a estudiantes universitarios en el departamento de Asuntos Estudiantiles. Opera en múltiples sedes de forma independiente. No requiere instalación de software — corre en el navegador.

## Stack

- **Framework:** Next.js (App Router)
- **Base de datos:** PostgreSQL (Vercel Postgres)
- **ORM:** Prisma
- **Autenticación:** NextAuth.js
- **Estilos:** Tailwind CSS v4
- **Lenguaje:** TypeScript 
- **Toasters:** Sileo https://sileo.aaryan.design/docs

## Flujo principal

El sistema tiene dos interfaces separadas:

### Pantalla de kiosco (pública, sin navegación)
- Es lo que ven los estudiantes. No tiene menú, botones de navegación, ni forma de salir.
- Flujo: escanear QR de cédula → escanear QR del artículo → el sistema determina automáticamente si es préstamo o devolución según el estado actual del artículo.
- El QR de la cédula chilena es una URL del Registro Civil. El RUN se extrae del parámetro `RUN` de esa URL.
- Barrera de 5 minutos mínimo entre operaciones sobre el mismo artículo para evitar dobles escaneos accidentales.
- Si pasan más de 30 segundos entre el primer y segundo escaneo, se cancela y vuelve al inicio.
- Tras completar una operación, muestra confirmación y vuelve al estado inicial automáticamente.

### Panel de gestión (protegido con login)
- Solo accesible por operadores y administradores.
- Contiene: préstamos activos, historial, inventario, dashboard de métricas, y gestión de sedes/usuarios.

## Roles

- **Admin:** Acceso global. Puede ver todas las sedes, crear sedes, crear usuarios, ver dashboard comparativo.
- **Operador:** Acceso limitado a su sede asignada. Ve préstamos, historial e inventario de su sede.

## Regla de negocio clave

Si un préstamo lleva más de 2 horas sin devolución, se considera vencido. El sistema debe marcarlos visualmente y un cron job (Vercel Cron) revisa periódicamente para actualizar este estado.

## Páginas

1. **`/kiosk`** — Pantalla de escaneo para estudiantes. Sin layout de gestión, sin navegación.
2. **`/login`** — Autenticación de operadores/admins.
3. **`/prestamos`** — Préstamos activos de la sede, con alerta visual en los vencidos. Devolución manual posible.
4. **`/historial`** — Préstamos pasados con filtros (fecha, RUN, artículo, estado). Exportable a CSV.
5. **`/inventario`** — Artículos de la sede, agregar/editar artículos, generar QR, gestionar categorías.
6. **`/dashboard`** — Métricas y estadísticas. Filtrable por sede y período.
7. **`/admin`** — Gestión de sedes y usuarios (solo admin).

## Modelo de datos (entidades principales)

- **Sede:** id, nombre, estado (activa/inactiva)
- **Usuario:** id, nombre, usuario, contraseña (hash), rol (admin/operador), sede asignada, estado (activo/inactivo)
- **Categoría:** id, nombre, sede
- **Artículo:** id, código interno, nombre, descripción, categoría, sede, estado (disponible/prestado/fuera de servicio)
- **Alumno:** id, RUN, nombre (se registra en el primer escaneo)
- **Préstamo:** id, artículo, alumno, sede, fecha/hora préstamo, fecha/hora devolución (null si activo), devuelto a tiempo (bool), devuelto por (manual/escaneo)

## Convenciones

- Usar App Router de Next.js (carpeta `app/`).
- Toda la UI en español.
- Nombres de variables y código en inglés.
- Componentes en PascalCase, archivos de componentes en kebab-case.
- Server Components por defecto. Client Components solo cuando se necesite interactividad.
- API routes en `app/api/`.
- Validación con Zod.
- Cada página tiene su propia carpeta con `page.tsx` y componentes locales si los necesita.

## Estructura de carpetas esperada

```
app/
  (kiosk)/
    kiosk/
      page.tsx
  (auth)/
    login/
      page.tsx
  (dashboard)/
    layout.tsx          ← layout con sidebar/nav para todas las páginas de gestión
    prestamos/
      page.tsx
    historial/
      page.tsx
    inventario/
      page.tsx
    dashboard/
      page.tsx
    admin/
      page.tsx
prisma/
  schema.prisma
lib/
  auth.ts
  db.ts
  utils.ts
components/
  ui/                   ← componentes reutilizables (botones, tablas, modales, etc.)
  kiosk/                ← componentes específicos del kiosco
  dashboard/            ← componentes específicos del panel de gestión
```

## Notas importantes

- El QR de la cédula chilena tiene formato URL: `https://portal.nuevosidiv.registrocivil.cl/document-validity?RUN=XXXXXXXX-X&type=CEDULA&serial=...&mrz=...`. Solo necesitamos extraer el parámetro `RUN`.
- Los QR de artículos los generamos nosotros. El contenido del QR es el código interno del artículo.
- La pantalla de kiosco debe estar completamente aislada del panel de gestión. Sin navegación, sin acceso al layout de gestión.
- El sistema debe funcionar con lector QR USB (que actúa como teclado) o con cámara del dispositivo. Para las primeras pruebas, usaremos la cámara de un celular. 