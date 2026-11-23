# Login (Supabase)

La app pide login solo si encuentra la configuración de Supabase. Sin ella funciona como siempre
(todo en el navegador, sin cuentas).

## 1. Variables de entorno (`.env`, no se sube al repo)

Crear un archivo `.env` en la raíz del proyecto con:

```
VITE_SUPABASE_URL=https://yddkxgpwrnqhuctfhkay.supabase.co
VITE_SUPABASE_ANON_KEY=<clave pública "anon" o "publishable" de Project Settings → API>
VITE_ALLOWED_EMAILS=<opcional: emails permitidos separados por coma>
```

- La clave **anon / publishable** es pública por diseño (va dentro de la app). **Nunca** poner la
  clave `service_role` en el `.env` ni en el código.
- `VITE_ALLOWED_EMAILS` es una segunda barrera en la app; la lista real se controla en Supabase
  (paso 2).
- `VITE_AUTH_DISABLED=1` apaga el login **solo en desarrollo** (lo usan las pruebas automáticas).
  En la app publicada (`npm run build`) se ignora.

Después de crear o cambiar el `.env`, reiniciar `npm run dev`.

## 2. Supabase (panel web, plan gratis)

1. **Authentication → Sign In / Providers → Email**: dejar **Email** habilitado y **desactivar
   "Allow new users to sign up"**. Así nadie se puede registrar solo.
2. **Authentication → Users → Add user → Send invitation**: invitar a cada email que tiene que
   poder entrar. Solo esos usuarios reciben el código.
3. **Authentication → URL Configuration**: en *Site URL* poner la dirección donde se usa la app
   (por ejemplo `http://localhost:5173` mientras se usa en la compu) y agregarla también en
   *Redirect URLs*, para que el enlace del email vuelva a la app.
4. Opcional, **Authentication → Emails → Magic Link**: la plantilla puede mostrar el código con
   `{{ .Token }}` además del enlace, así se puede entrar escribiendo el código.

El plan gratis alcanza para pocos usuarios. El envío de emails de Supabase tiene un límite bajo
por hora; si hiciera falta más, se configura un SMTP propio en *Authentication → Emails*.

## Cómo entra el usuario

1. Escribe su email y toca **Enviar código**.
2. Recibe un email con un código y un enlace: escribe el código o toca el enlace.
3. Si el email no fue invitado, Supabase no manda nada y la app avisa que no tiene acceso.
4. **Salir** (arriba a la derecha) cierra la sesión.

## 3. Proyectos en la nube (Fase 8)

Una sola vez: en Supabase → **SQL Editor**, pegar y ejecutar, en orden:

1. `supabase/001_proyectos.sql`: la tabla `projects` con sus políticas (solo los usuarios con sesión,
   los invitados del equipo, pueden leer y escribir; sin sesión, nada).
2. `supabase/002_archivos.sql`: el bucket privado `assets` de Storage, donde van las imágenes y los
   modelos pesados de los proyectos (plano de referencia, fondo del render, modelos 3D importados).
   Así la base queda liviana; el plan gratis da 1 GB de archivos.

Con eso, al entrar a la app:

- Los proyectos que estaban en esa compu se suben solos la primera vez.
- Cada cambio se guarda en la compu al instante y en la nube unos segundos después. Arriba se ve
  el estado: **✓ Guardado**, **Guardando…** o **⚠ Sin conexión** (los cambios quedan en la compu
  y se suben solos cuando vuelve internet).
- Todo el equipo ve los mismos proyectos. Si dos personas editan el mismo proyecto a la vez, queda
  el último guardado.

El plan gratis de Supabase pausa el proyecto si pasa una semana sin uso; se reactiva desde el panel
(*Restore project*).
