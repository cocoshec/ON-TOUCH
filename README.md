# On-Touch Consulting — sitio web

Sitio corporativo de On-Touch Consulting, C.A. Software empresarial y sistemas ERP a medida.

---

## Estructura

```
.
├── index.html              Página principal (una sola página, con todas las secciones)
├── proyectos.html          Redirección a index.html#proyectos (enlaces antiguos)
├── .htaccess               Redirecciones, HTTPS, caché y compresión (Apache/cPanel)
├── 404.html                Página de error
├── server.js               Servidor Node: sirve el sitio + API de contacto
├── mail.php                Alternativa PHP para el formulario (hosting sin Node)
├── site.webmanifest        Manifiesto de aplicación web
├── robots.txt / sitemap.xml
├── assets/
│   ├── css/style.css       Hoja de estilos única
│   ├── js/main.js          JavaScript único, sin dependencias
│   ├── fonts/              Syne y Serotiva (tipografías de marca)
│   └── img/
│       ├── clientes/       39 logotipos de clientes en WebP
│       ├── proyectos/      Capturas: versión grande + miniatura
│       └── …               Logotipo, iconos y imagen para redes
├── tools/
│   └── optimizar-imagenes.py   Convierte y recorta imágenes nuevas
├── ON TOUCH/               Manual de marca original (no se publica)
└── _backup/                Versión anterior del sitio
```

---

## Identidad de marca

Los colores y las tipografías salen del manual **BRAND NEW BEGINNING – ON TOUCH**
(`ON TOUCH/BRAND NEW BEGINNING - ON TOUCH/`).

| Color         | Hex       | Uso                                  |
| ------------- | --------- | ------------------------------------ |
| Bush          | `#082521` | Fondo principal                      |
| Surfie Green  | `#127A77` | Secundario, degradados               |
| Kelly Green   | `#62B313` | Acción principal, enlaces            |
| Dandelion     | `#E2EE25` | Acentos y realces                    |
| Foam          | `#DAFBFC` | Texto sobre fondo oscuro             |
| Mercury       | `#E6E7E9` | Neutro claro                         |

Tipografías: **Syne** para titulares y **Serotiva** para texto corrido.
Ambas están auto-alojadas en `assets/fonts/`, así que el sitio no depende de
Google Fonts.

Todos los valores viven como variables CSS en `:root`, al inicio de
`assets/css/style.css`. Cambiar la marca es cambiar esas líneas.

---

## Puesta en marcha

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar el correo

Copia `.env.example` a `.env` y rellena las credenciales SMTP:

```bash
cp .env.example .env
```

| Variable      | Descripción                                    |
| ------------- | ---------------------------------------------- |
| `PORT`        | Puerto del servidor (por defecto 3000)         |
| `SMTP_HOST`   | Servidor de correo saliente                    |
| `SMTP_PORT`   | 587 (TLS) o 465 (SSL)                          |
| `SMTP_SECURE` | `true` solo si usas el puerto 465              |
| `SMTP_USER`   | Usuario de la cuenta                           |
| `SMTP_PASS`   | Contraseña o clave de aplicación               |
| `SMTP_FROM`   | Remitente que verá el destinatario             |
| `TO_EMAIL`    | Buzón que recibe los mensajes del formulario   |

> `.env` está en `.gitignore`: nunca lo subas al repositorio.

### 3. Arrancar

```bash
npm start
```

El sitio queda en <http://localhost:3000>. Para desarrollo con recarga
automática: `npm run dev`.

---

## Formulario de contacto

El formulario envía JSON por `fetch` a `POST /api/contact`.

- **Validación** en el navegador y de nuevo en el servidor.
- **Límite de peticiones**: 6 por minuto por IP.
- **Campo trampa** (`website`) contra robots de spam.
- **Plan B**: si el envío falla, la página ofrece un enlace de WhatsApp con el
  mensaje ya redactado, para que ningún contacto se pierda.

### Si tu alojamiento no ejecuta Node

Usa `mail.php`: cambia el atributo `data-endpoint` del formulario en
`index.html`.

```html
<form id="contact-form" novalidate data-endpoint="mail.php" ...>
```

### Comprobar el estado

```bash
curl http://localhost:3000/api/health
```

Devuelve `{"ok":true,"smtp":true,...}` cuando el correo está configurado.

---

## Editar el contenido

| Qué quieres cambiar        | Dónde                                                   |
| -------------------------- | ------------------------------------------------------- |
| Textos, servicios, FAQ     | `index.html`                                             |
| Proyectos del portafolio   | `index.html`, sección `#proyectos`, bloques `<article class="project">` |
| Logotipos de clientes      | `index.html`, sección `#clientes`, bloques `.logo-chip`   |
| Colores y tipografías      | `:root` en `assets/css/style.css`                        |
| Teléfono, correo, redes    | Buscar `584122118606` y `gerencia@on-touch.net`          |

### Añadir un servicio

Copia un bloque `<article class="card service-card grid-item cat-…">` dentro de
`#services-grid`. La clase `cat-…` define en qué filtro aparece
(`cat-gestion`, `cat-comercial`, `cat-vertical`, `cat-movil`).

### Añadir un proyecto

Copia un `<article class="project tilt grid-item …">` en `#projects-grid`,
dentro de la sección `#proyectos` de `index.html`. La clase de categoría debe
coincidir con el `data-filter` de algún botón. El botón `.project__zoom` abre
el visor de imágenes mediante `data-lightbox`.

### Una sola página

Todas las secciones viven en `index.html` y el menú funciona sólo con
desplazamiento suave: no hay ningún enlace que recargue la página. Los
proyectos estaban antes en una página aparte; `proyectos.html` se conserva
únicamente como redirección (`.htaccess` hace un 301, y el propio archivo
redirige por si el servidor no lee `.htaccess`).

Si algún día el portafolio crece a doce o más proyectos con casos detallados,
tiene sentido volver a separarlo: la copia de la página completa quedó en
`_backup/proyectos-pagina-completa.html`.

---

## Detalles técnicos

- **Sin dependencias de terceros en el navegador**, salvo los iconos de Font
  Awesome. Nada de jQuery, Bootstrap, Owl Carousel ni Isotope.
- **Cuidado con los nombres de clase**: Font Awesome define `.fab`, `.fas`,
  `.far`, `.fa` y `.fa-*`, y su hoja carga después de `style.css`, así que
  gana cualquier empate. Los botones flotantes se llaman `.float-btn` por eso.
  No uses ninguno de esos nombres para elementos propios.
- **Contraste**: los tres niveles de texto (`--text`, `--text-muted`,
  `--text-faint`) superan 4.5:1 sobre el fondo Bush, el mínimo de la norma
  para texto pequeño.
- **Animaciones**: todas usan `opacity`, `translate`, `scale` y `transform`,
  que el navegador resuelve en la GPU; los manejadores de scroll van dentro de
  `requestAnimationFrame`. El filtrado de rejillas usa la técnica FLIP para que
  las tarjetas se deslicen a su nueva posición en vez de saltar.
- **Accesibilidad**: enlace para saltar al contenido, navegación por teclado en
  el visor de imágenes, `aria-*` en menú y filtros, foco visible y respeto por
  `prefers-reduced-motion`.
- **Rendimiento**: imágenes con `loading="lazy"`, tipografías precargadas, un
  solo CSS y un solo JS.
- **SEO**: metadatos, Open Graph, `sitemap.xml`, `robots.txt` y datos
  estructurados `ProfessionalService` en JSON-LD.
- **Sin JavaScript** el sitio se sigue leyendo completo: las animaciones de
  entrada solo se activan cuando el script está presente.

---

## Imágenes

Todas las imágenes son **locales y en WebP**. El sitio ya no depende de
`i.postimg.cc` ni de ningún otro servicio externo.

| Carpeta                   | Qué contiene                                        |
| ------------------------- | --------------------------------------------------- |
| `assets/img/clientes/`    | 39 logotipos, recortados y a 360 px máximo           |
| `assets/img/proyectos/`   | Capturas: `nombre.webp` (visor) y `nombre-thumb.webp` (tarjeta) |
| `assets/img/`             | Logotipo, iconos 180/192/512 y `og-image.jpg`        |
| `favicon.ico`             | Icono multi-resolución para navegadores y cPanel     |

### Añadir imágenes nuevas

El script hace la conversión y te imprime el HTML listo para pegar:

```bash
python -m pip install pillow
```

Captura de un proyecto:

```bash
python tools/optimizar-imagenes.py proyecto "C:/ruta/captura.png" hoteleria
```

Logotipo de un cliente:

```bash
python tools/optimizar-imagenes.py cliente "C:/ruta/logo.png" "Nombre del Cliente"
```

Una carpeta entera de logotipos de golpe:

```bash
python tools/optimizar-imagenes.py clientes-carpeta "C:/ruta/carpeta"
```

### Proyectos sin captura propia

Cuando varios proyectos comparten la misma portada, mostrarlos todos con la
misma imagen se ve mal. Para esos casos existe la **portada de marca**: un
bloque `.project__cover` con el color de la categoría, un icono y el nombre.
Cada categoría tiene su color, así la rejilla se ve variada aunque no haya
capturas distintas.

```html
<div class="project__cover">
  <div class="project__chrome" aria-hidden="true"><span></span><span></span><span></span></div>
  <div class="project__cover-inner">
    <div class="project__cover-icon"><i class="fa-solid fa-truck-fast"></i></div>
    <p class="project__cover-label">Distribución</p>
  </div>
</div>
```

Colores disponibles, como clase en el `<article>`: `project--administracion`,
`project--comercial`, `project--nominas`, `project--distribucion`,
`project--produccion`, `project--movil`.

Cuando tengas la captura real, cambia ese `.project__cover` por el bloque
`.project__media` que usan los dos primeros proyectos.

---

## Animaciones

| Qué hace                              | Cómo se activa                                  |
| ------------------------------------- | ----------------------------------------------- |
| Entrada al aparecer en pantalla       | `data-reveal` en cualquier elemento              |
| Dirección de entrada                  | `data-reveal="left" \| "right" \| "scale" \| "up" \| "blur"` |
| Retraso propio                        | `style="--reveal-delay:200ms"`                   |
| Titular palabra a palabra             | `data-split` en el `<h1>`/`<h2>`                 |
| Inclinación 3D con reflejo            | clase `tilt` en la tarjeta                       |
| Botón que se acerca al puntero        | `data-magnetic` en el botón                      |

Los hermanos de una misma rejilla se escalonan solos: no hace falta poner un
`--reveal-delay` a cada tarjeta.

Todo queda desactivado si el sistema tiene activado *reducir movimiento*, y la
inclinación y el magnetismo no se aplican en pantallas táctiles.

---

## Publicar en cPanel

El sitio es HTML estático: **no necesita Node en el servidor**.

### El ciclo de trabajo

Cada vez que cambies algo, son dos comandos:

```bash
python tools/preparar-deploy.py
```

```bash
python tools/subir.py
```

El primero crea `deploy/` y `on-touch-web.zip` con los 69 archivos que deben
vivir en `public_html`. Deja fuera `server.js`, `package*.json`, `.env`,
`_backup/`, `ON TOUCH/`, `tools/` y `README.md`, y aborta si alguno se cuela.

El segundo los sube por FTP, **transfiriendo sólo lo que cambió**: guarda la
huella SHA-256 de cada archivo enviado en `.deploy-state.json` y compara. Si
tocas una línea del CSS, sube un archivo, no sesenta y nueve. Nunca borra nada
del servidor.

| Comando | Qué hace |
| ------- | -------- |
| `python tools/subir.py` | Sube lo que cambió |
| `python tools/subir.py --simular` | Enseña qué subiría, sin tocar nada |
| `python tools/subir.py --todo` | Fuerza la subida completa |

Las credenciales FTP van en tu `.env` (ver `.env.example`), que nunca se sube
ni entra en el repositorio. La conexión usa FTPS cifrado; si el hosting no lo
admite, el script avisa y pide confirmación antes de usar FTP en claro.

### Cuidado al crear la cuenta FTP: verifica el Document Root primero

Al crear una cuenta FTP, cPanel sugiere un directorio con el nombre del
dominio (`public_html/tudominio.net`) aunque ese dominio sea el **principal**
de la cuenta — en ese caso la carpeta real es `public_html` a secas, sin la
subcarpeta. Si aceptas la sugerencia sin comprobar, la cuenta queda un nivel
por debajo de donde vive el sitio, **enjaulada** (no puede subir con `..` ni
con rutas absolutas), y todo lo que subas por ahí no aparecerá nunca en la
web aunque el proceso reporte éxito.

Antes de crear la cuenta: cPanel → **Domains** → columna **Document Root** del
dominio. Usa exactamente esa ruta en el campo Directorio, sin añadir nada.

Para comprobar que una cuenta FTP realmente escribe donde se sirve el sitio,
sube un archivo de prueba con nombre único y pídelo por HTTPS:

```bash
python - <<'EOF'
import io, ftplib, ssl, time
cfg = {}
for l in io.open('.env', encoding='utf-8'):
    l = l.strip()
    if l and not l.startswith('#') and '=' in l:
        k, v = l.split('=', 1); cfg[k] = v.split('#')[0].strip()
ctx = ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
ftp = ftplib.FTP_TLS(context=ctx); ftp.connect(cfg['FTP_HOST']); ftp.login(cfg['FTP_USER'], cfg['FTP_PASS']); ftp.prot_p()
ftp.storbinary('STOR prueba.txt', io.BytesIO(b'ok'))
ftp.quit()
EOF
curl https://tudominio.net/prueba.txt   # debe devolver "ok"; si da 404, la carpeta está mal
```

### El destino del formulario no se reescribe

`index.html` apunta siempre a `mail.php`, igual en local que en producción.
Para poder probarlo sin PHP, `server.js` atiende esa misma ruta además de
`/api/contact`. Así el HTML que pruebas y el que publicas son idénticos, y no
existe la clase de fallo de «en local funcionaba».

### Aviso: Sitejet Builder

La cuenta tiene **Sitejet Builder** gestionando `on-touch.net`; la plantilla
«Mark Parker» que se ve publicada viene de ahí. Sitejet publica sus archivos
dentro de `public_html`, así que si se pulsa «Publicar» en Sitejet después de
subir el sitio, lo sobrescribe. Hay que dejar de usar Sitejet para este
dominio antes de subir.

1. En cPanel, entra en *Administrador de archivos* → `public_html`.
2. Borra lo que haya de la web anterior.
3. Sube el contenido de esta carpeta **excepto** `node_modules/`, `_backup/`,
   `ON TOUCH/`, `tools/`, `server.js`, `package*.json` y `.env`.
   Incluye el `.htaccess` (es un archivo oculto: activa «mostrar archivos
   ocultos» en el Administrador de archivos).
4. Como cPanel no ejecuta Node, cambia el destino del formulario en
   `index.html` para que use PHP:

   ```html
   <form id="contact-form" novalidate data-endpoint="mail.php" ...>
   ```

5. Comprueba que `favicon.ico` quedó en la raíz de `public_html`.

### Antes de publicar

1. Si el dominio no es `www.on-touch.net`, cámbialo en `canonical`, Open Graph,
   `sitemap.xml` y `robots.txt`.
2. Activa el certificado SSL de cPanel y fuerza HTTPS.
3. Comprueba que `mail.php` envía: cPanel suele exigir que el remitente sea una
   cuenta del propio dominio.
