/**
 * On-Touch Consulting — servidor web
 *
 * Hace dos cosas:
 *   1. Sirve el sitio estático (index.html, proyectos.html, assets…).
 *   2. Expone POST /api/contact, que envía el formulario por SMTP.
 *
 * Configuración: copia .env.example a .env y rellena las credenciales.
 */

const path = require('path');
const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

/* --------------------------------------------------------------------------
   Seguridad y middlewares
   -------------------------------------------------------------------------- */

// Todas las imágenes son locales; lo único externo es Font Awesome (cdnjs).
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://cdnjs.cloudflare.com', "'unsafe-inline'"],
        fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'data:'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

app.use(cors());
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: true, limit: '32kb' }));

/* --------------------------------------------------------------------------
   Sitio estático
   -------------------------------------------------------------------------- */

// Los proyectos pasaron a ser una sección de la portada. Se mantiene la
// dirección antigua con una redirección permanente.
app.get('/proyectos.html', (req, res) => res.redirect(301, '/#proyectos'));
app.get('/proyectos', (req, res) => res.redirect(301, '/#proyectos'));

app.use(
  express.static(path.join(__dirname), {
    extensions: ['html'],
    setHeaders(res, filePath) {
      // Los recursos versionados se pueden cachear; el HTML no.
      if (/\.(css|js|png|jpe?g|webp|svg|otf|ttf|woff2?)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=604800');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  })
);

/* --------------------------------------------------------------------------
   Correo
   -------------------------------------------------------------------------- */

const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true', // true para el puerto 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;

if (transporter) {
  transporter.verify(function (err) {
    if (err) console.warn('[smtp] No se pudo verificar la conexión:', err.message);
    else console.log('[smtp] Conexión verificada correctamente.');
  });
} else {
  console.warn('[smtp] Sin credenciales en .env — /api/contact responderá 503.');
}

const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' }
});

/* --------------------------------------------------------------------------
   Utilidades
   -------------------------------------------------------------------------- */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#47;' };

function escapeHtml(text = '') {
  return String(text).replace(/[&<>"'/]/g, (s) => ESCAPES[s]);
}

function nl2br(str = '') {
  return String(str).replace(/\n/g, '<br>');
}

// Evita la inyección de cabeceras: nada de saltos de línea en Reply-To ni asunto.
function singleLine(text = '', max = 200) {
  return String(text).replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* --------------------------------------------------------------------------
   API de contacto
   -------------------------------------------------------------------------- */

// El formulario apunta a mail.php porque es lo que se usa en el hosting
// (cPanel con PHP). En local no hay PHP, así que Node atiende esa misma ruta:
// de este modo el HTML publicado y el de desarrollo son idénticos.
app.post(['/api/contact', '/mail.php'], contactLimiter, async (req, res) => {
  const body = req.body || {};

  // Campo trampa: si un robot lo rellena, respondemos éxito sin enviar nada.
  if (body.website) {
    return res.json({ success: true, message: 'Mensaje enviado correctamente.' });
  }

  const empresa = singleLine(body.empresa, 120);
  const email = singleLine(body.email, 160);
  const telefono = singleLine(body.telefono, 40);
  const asunto = singleLine(body.asunto, 120) || 'Contacto desde el sitio web';
  const mensaje = String(body.mensaje || '').trim().slice(0, 5000);

  const errores = [];
  if (!empresa) errores.push('empresa');
  if (!EMAIL_RE.test(email)) errores.push('email');
  if (!telefono) errores.push('telefono');
  if (mensaje.length < 10) errores.push('mensaje');

  if (errores.length) {
    return res.status(400).json({
      success: false,
      message: 'Revisa los datos del formulario.',
      fields: errores
    });
  }

  if (!transporter) {
    return res.status(503).json({
      success: false,
      message: 'El envío de correo no está configurado en el servidor.'
    });
  }

  const fechaTexto = new Intl.DateTimeFormat('es-VE', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Caracas'
  }).format(new Date()) + ' (hora de Venezuela)';

  const soloDigitos = telefono.replace(/\D+/g, '');

  // La mayoría de los visitantes escribe su número en formato local
  // venezolano ("0412-1234567"), no internacional. wa.me exige el código
  // de país (58) y sin el 0 inicial.
  function numeroWhatsapp(digitos) {
    if (!digitos) return null;
    if (digitos.length === 11 && digitos[0] === '0') return '58' + digitos.slice(1);
    if (digitos.length === 10) return '58' + digitos;
    return digitos; // ya trae código de país (u otro formato)
  }

  const numeroWa = numeroWhatsapp(soloDigitos);
  const whatsappCliente = numeroWa ? `https://wa.me/${numeroWa}` : null;
  const telefonoEnlace = whatsappCliente || (soloDigitos ? `tel:${soloDigitos}` : null);

  const fila = (etiqueta, valor, enlace) =>
    '<tr><td style="padding:9px 0;border-top:1px solid rgba(218,251,252,.14);width:130px;vertical-align:top;font-family:Arial,sans-serif;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:rgba(218,251,252,.55)">' + etiqueta + '</td>' +
    '<td style="padding:9px 0;border-top:1px solid rgba(218,251,252,.14);font-family:Arial,sans-serif;font-size:15px;color:#eaf7f6">' +
    (enlace ? '<a href="' + enlace + '" style="color:#eaf7f6;text-decoration:none">' + escapeHtml(valor) + '</a>' : escapeHtml(valor)) +
    '</td></tr>';

  const botonesRespuesta = whatsappCliente
    ? '<a href="' + whatsappCliente + '" style="display:inline-block;margin-right:10px;padding:12px 22px;background:#62b313;color:#082521;text-decoration:none;font-weight:700;border-radius:999px;font-family:Arial,sans-serif;font-size:14px">Responder por WhatsApp</a>' +
      '<a href="mailto:' + email + '?subject=' + encodeURIComponent('Re: ' + asunto) + '" style="display:inline-block;padding:12px 22px;background:transparent;color:#eaf7f6;text-decoration:none;font-weight:700;border-radius:999px;border:1px solid rgba(218,251,252,.35);font-family:Arial,sans-serif;font-size:14px">Responder por correo</a>'
    : '<a href="mailto:' + email + '?subject=' + encodeURIComponent('Re: ' + asunto) + '" style="display:inline-block;padding:12px 22px;background:#62b313;color:#082521;text-decoration:none;font-weight:700;border-radius:999px;font-family:Arial,sans-serif;font-size:14px">Responder por correo</a>';

  // Correo de marca (HTML) con respaldo en texto plano — misma plantilla que mail.php
  const html =
    '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Nuevo contacto — On-Touch</title></head>' +
    '<body style="margin:0;padding:0;background:#04140f;font-family:Arial,sans-serif">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#04140f;padding:32px 16px">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#082521;border-radius:16px;overflow:hidden;border:1px solid rgba(218,251,252,.12)">' +
    '<tr><td style="padding:26px 32px;background:linear-gradient(120deg,#127a77,#62b313 65%,#e2ee25);">' +
    '<span style="font-family:Arial,sans-serif;font-weight:800;font-size:20px;letter-spacing:.02em;color:#082521">ON&#9679;TOUCH</span>' +
    '</td></tr>' +
    '<tr><td style="padding:28px 32px 4px">' +
    '<p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#e2ee25;font-weight:700">Nuevo contacto</p>' +
    '<h1 style="margin:0;font-family:Arial,sans-serif;font-size:22px;color:#eaf7f6">' + escapeHtml(asunto) + '</h1>' +
    '</td></tr>' +
    '<tr><td style="padding:18px 32px 6px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    fila('Empresa', empresa) +
    fila('Correo', email, 'mailto:' + email) +
    fila('Teléfono', telefono, telefonoEnlace) +
    fila('Recibido', fechaTexto) +
    '</table>' +
    '</td></tr>' +
    '<tr><td style="padding:22px 32px 6px">' +
    '<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:rgba(218,251,252,.55)">Mensaje</p>' +
    '<div style="padding:16px 18px;background:rgba(218,251,252,.05);border:1px solid rgba(218,251,252,.14);border-left:3px solid #62b313;border-radius:10px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#eaf7f6">' + nl2br(escapeHtml(mensaje)) + '</div>' +
    '</td></tr>' +
    '<tr><td style="padding:8px 32px 30px">' + botonesRespuesta + '</td></tr>' +
    '<tr><td style="padding:16px 32px;background:rgba(4,20,18,.6);border-top:1px solid rgba(218,251,252,.1)">' +
    '<p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:rgba(218,251,252,.42)">Enviado automáticamente desde el formulario de contacto de on-touch.net</p>' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>';

  const text =
    `Nuevo contacto desde el sitio web — On-Touch Consulting\n${'-'.repeat(46)}\n\n` +
    `Empresa:        ${empresa}\nCorreo:         ${email}\nTeléfono:       ${telefono}\n` +
    `Área de interés: ${asunto}\nRecibido:       ${fechaTexto}\n\nMensaje:\n${mensaje}\n\n${'-'.repeat(46)}\n` +
    `Responder por correo: ${email}\n` + (whatsappCliente ? `Responder por WhatsApp: ${whatsappCliente}\n` : '');

  try {
    await transporter.sendMail({
      from: `"Contacto web On-Touch" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: process.env.TO_EMAIL || 'clientes@on-touch.net',
      replyTo: `"${empresa}" <${email}>`,
      subject: `Nuevo contacto web: ${asunto} — ${empresa}`,
      text,
      html
    });

    return res.json({ success: true, message: 'Mensaje enviado. Te responderemos muy pronto.' });
  } catch (err) {
    console.error('[contact] Error al enviar:', err.message);
    return res.status(500).json({
      success: false,
      message: 'No pudimos enviar el mensaje. Escríbenos por WhatsApp mientras lo revisamos.'
    });
  }
});

/* --------------------------------------------------------------------------
   Estado y 404
   -------------------------------------------------------------------------- */

app.get('/api/health', (req, res) => {
  res.json({ ok: true, smtp: smtpConfigured, uptime: Math.round(process.uptime()) });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'), (err) => {
    if (err) res.status(404).type('txt').send('404 — Página no encontrada');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`On-Touch escuchando en http://localhost:${PORT}`));
