# Gaceta Survival · MineLatino

Sitio comunitario (no oficial) de noticias sobre el Survival Clásico de MineLatino.
Los jugadores envían noticias, el equipo moderador las revisa y, si las aprueba, se publican.

- **Alojamiento:** GitHub Pages (gratis)
- **Base de datos, cuentas e imágenes:** Supabase (plan gratuito)
- **Inicio de sesión:** Discord

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La página |
| `styles.css` | El diseño |
| `app.js` | La lógica (envíos, moderación, búsqueda) |
| `config.js` | **Lo único que tienes que editar:** la conexión a tu Supabase |
| `supabase/schema.sql` | Tablas, permisos y noticias de demostración. Se pega una vez en Supabase |

---

## Paso 1 · Crear el proyecto en Supabase

1. Entra a <https://supabase.com>, crea una cuenta y luego **New project**.
   Elige un nombre (por ejemplo `gaceta-survival`), una contraseña para la base de datos y la región más cercana a tus jugadores.
2. Cuando termine de crearse, ve a **SQL Editor → New query**, pega todo el contenido de `supabase/schema.sql` y pulsa **Run**.
   Debe terminar sin errores.
3. Ve a **Project Settings → API** y copia:
   - **Project URL** (algo como `https://abcdxyz.supabase.co`)
   - **anon public** key
4. Abre `config.js` y pega esos dos valores.

> La clave *anon* es pública a propósito: lo que protege los datos son las reglas del archivo SQL.
> **Nunca** pongas la clave `service_role` en el sitio.

## Paso 2 · Activar el inicio de sesión con Discord

1. Entra a <https://discord.com/developers/applications> → **New Application** (nombre: `Gaceta Survival`).
2. En **OAuth2**:
   - Copia el **Client ID** y pulsa **Reset Secret** para obtener el **Client Secret**.
   - En **Redirects** añade: `https://TU-PROYECTO.supabase.co/auth/v1/callback`
     (usa tu Project URL del paso 1).
3. En Supabase: **Authentication → Sign In / Providers → Discord**, actívalo y pega el Client ID y el Client Secret. Guarda.

## Paso 3 · Publicar en GitHub Pages

Sin instalar nada:

1. En <https://github.com> crea un repositorio nuevo, **público**, llamado `gaceta-survival`.
2. Pulsa **uploading an existing file** y arrastra **todo el contenido** de esta carpeta
   (`index.html`, `styles.css`, `app.js`, `config.js`, `README.md` y la carpeta `supabase`). Pulsa **Commit changes**.
3. Ve a **Settings → Pages**. En *Source* elige **Deploy from a branch**, rama `main`, carpeta `/ (root)` y guarda.
4. En uno o dos minutos tu sitio estará en:
   `https://TU-USUARIO.github.io/gaceta-survival/`

## Paso 4 · Decirle a Supabase cuál es tu sitio

En Supabase: **Authentication → URL Configuration**

- **Site URL:** `https://TU-USUARIO.github.io/gaceta-survival/`
- **Redirect URLs:** añade la misma dirección.

Sin esto, al volver de Discord no se iniciará la sesión.

## Paso 5 · Nombrar moderadores

1. La persona entra al sitio con Discord y abre **Mis envíos**. Abajo verá **Tu ID de usuario**, que puede copiar.
2. En Supabase → **SQL Editor** ejecuta:

   ```sql
   insert into public.moderators (user_id) values ('PEGA-AQUÍ-EL-ID');
   ```

3. La persona recarga el sitio y verá la pestaña **Moderación**.

Para quitar a alguien:

```sql
delete from public.moderators where user_id = 'EL-ID';
```

---

## Cómo funciona la privacidad

- **Noticias publicadas:** cualquiera puede leerlas, sin iniciar sesión.
- **Envíos** (texto, nick, contacto privado y capturas): solo los ven quien envió y el equipo moderador.
- **Capturas:** se guardan en un espacio privado. Solo se vuelve pública la imagen que moderación elige como portada al publicar.
- **Anonimato:** si el remitente lo pide, la noticia sale como “Remitente anónimo”, pero moderación conserva su contacto privado.
- **Límite contra spam:** 10 envíos por persona al día.
- **Respuestas:** el remitente solo puede responder cuando moderación le pide más información. No puede cambiar su envío ni su estado.

## Actualizar el sitio

Edita los archivos y súbelos de nuevo al repositorio (**Add file → Upload files**, reemplazando los anteriores).
GitHub Pages se actualiza solo en uno o dos minutos.

## Dominio propio (opcional)

En **Settings → Pages → Custom domain** puedes poner un dominio que hayas comprado.
Después actualiza la *Site URL* y las *Redirect URLs* de Supabase con el dominio nuevo.
