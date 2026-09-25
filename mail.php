<?php
/**
 * On-Touch Consulting — respaldo del formulario de contacto para hosting PHP.
 *
 * El sitio envía el formulario por JSON a /api/contact (server.js). Si tu
 * alojamiento no ejecuta Node, apunta el atributo data-endpoint del formulario
 * a "mail.php" y este script hará el mismo trabajo.
 *
 * Acepta tanto JSON como POST tradicional y responde siempre en JSON.
 * El correo que llega a bandeja de entrada usa la identidad de marca
 * (HTML) con una versión en texto plano como respaldo.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const DESTINATARIO = 'clientes@on-touch.net';

function responder(bool $ok, string $mensaje, int $codigo = 200, array $extra = []): void
{
    http_response_code($codigo);
    echo json_encode(array_merge(['success' => $ok, 'message' => $mensaje], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    responder(false, 'Método de solicitud no válido.', 405);
}

// El formulario envía JSON; mantenemos compatibilidad con POST clásico.
$datos = $_POST;
$crudo = file_get_contents('php://input');
if ($crudo !== '' && empty($datos)) {
    $json = json_decode($crudo, true);
    if (is_array($json)) {
        $datos = $json;
    }
}

// Campo trampa contra robots: si viene relleno, fingimos éxito y no enviamos.
if (!empty($datos['website'])) {
    responder(true, 'Mensaje enviado correctamente.');
}

/** Elimina saltos de línea para evitar inyección de cabeceras de correo. */
function una_linea($valor, int $max = 200): string
{
    return mb_substr(trim(preg_replace('/[\r\n]+/', ' ', (string) $valor)), 0, $max);
}

$empresa  = una_linea($datos['empresa']  ?? '', 120);
$email    = una_linea($datos['email']    ?? '', 160);
$telefono = una_linea($datos['telefono'] ?? '', 40);
$asunto   = una_linea($datos['asunto']   ?? '', 120) ?: 'Contacto desde el sitio web';
$mensaje  = mb_substr(trim((string) ($datos['mensaje'] ?? '')), 0, 5000);

$errores = [];
if ($empresa === '')                                        $errores[] = 'empresa';
if (!filter_var($email, FILTER_VALIDATE_EMAIL))             $errores[] = 'email';
if ($telefono === '')                                       $errores[] = 'telefono';
if (mb_strlen($mensaje) < 10)                               $errores[] = 'mensaje';

if ($errores) {
    responder(false, 'Revisa los datos del formulario.', 400, ['fields' => $errores]);
}

/* --------------------------------------------------------------------------
   Construcción del correo: versión HTML de marca + texto plano de respaldo
   -------------------------------------------------------------------------- */

$fecha = new DateTime('now', new DateTimeZone('America/Caracas'));
$fechaTexto = $fecha->format('d/m/Y') . ' a las ' . $fecha->format('H:i') . ' (hora de Venezuela)';

/**
 * Normaliza un teléfono venezolano al formato que exige wa.me: código de
 * país (58) y sin el 0 inicial. La mayoría de los visitantes escribe su
 * número en formato local ("0412-1234567"), no internacional.
 */
function numero_whatsapp(string $telefono): ?string
{
    $digitos = preg_replace('/\D+/', '', $telefono);
    if ($digitos === '') return null;
    if (strlen($digitos) === 11 && $digitos[0] === '0') {
        return '58' . substr($digitos, 1);       // 0412XXXXXXX -> 58412XXXXXXX
    }
    if (strlen($digitos) === 10) {
        return '58' . $digitos;                   // 412XXXXXXX -> 58412XXXXXXX
    }
    return $digitos;                               // ya trae código de país (u otro formato)
}

$soloDigitos = preg_replace('/\D+/', '', $telefono);
$numeroWhatsapp = numero_whatsapp($telefono);
$whatsappCliente = $numeroWhatsapp !== null ? 'https://wa.me/' . $numeroWhatsapp : null;

function e(string $texto): string
{
    return htmlspecialchars($texto, ENT_QUOTES, 'UTF-8');
}

function nl2br_seguro(string $texto): string
{
    return nl2br(e($texto));
}

// --- Texto plano (respaldo para clientes de correo sin HTML) ---
$textoPlano = "Nuevo contacto desde el sitio web — On-Touch Consulting\n"
    . str_repeat('-', 46) . "\n\n"
    . "Empresa:        {$empresa}\n"
    . "Correo:         {$email}\n"
    . "Teléfono:       {$telefono}\n"
    . "Área de interés: {$asunto}\n"
    . "Recibido:       {$fechaTexto}\n\n"
    . "Mensaje:\n{$mensaje}\n\n"
    . str_repeat('-', 46) . "\n"
    . "Responder por correo: {$email}\n"
    . ($whatsappCliente ? "Responder por WhatsApp: {$whatsappCliente}\n" : '');

// --- HTML de marca (paleta y tipografías del sitio) ---
$filaWhatsapp = $whatsappCliente
    ? '<tr><td style="padding:14px 0 0"><a href="' . e($whatsappCliente) . '" style="display:inline-block;margin-right:10px;padding:12px 22px;background:#62b313;color:#082521;text-decoration:none;font-weight:700;border-radius:999px;font-family:Arial,sans-serif;font-size:14px">Responder por WhatsApp</a>'
      . '<a href="mailto:' . e($email) . '?subject=' . rawurlencode('Re: ' . $asunto) . '" style="display:inline-block;padding:12px 22px;background:transparent;color:#eaf7f6;text-decoration:none;font-weight:700;border-radius:999px;border:1px solid rgba(218,251,252,.35);font-family:Arial,sans-serif;font-size:14px">Responder por correo</a></td></tr>'
    : '<tr><td style="padding:14px 0 0"><a href="mailto:' . e($email) . '?subject=' . rawurlencode('Re: ' . $asunto) . '" style="display:inline-block;padding:12px 22px;background:#62b313;color:#082521;text-decoration:none;font-weight:700;border-radius:999px;font-family:Arial,sans-serif;font-size:14px">Responder por correo</a></td></tr>';

function filaDato(string $etiqueta, string $valor, ?string $enlace = null): string
{
    $contenido = $enlace ? '<a href="' . e($enlace) . '" style="color:#eaf7f6;text-decoration:none">' . e($valor) . '</a>' : e($valor);
    return '<tr>'
        . '<td style="padding:9px 0;border-top:1px solid rgba(218,251,252,.14);width:130px;vertical-align:top;font-family:Arial,sans-serif;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:rgba(218,251,252,.55)">' . e($etiqueta) . '</td>'
        . '<td style="padding:9px 0;border-top:1px solid rgba(218,251,252,.14);font-family:Arial,sans-serif;font-size:15px;color:#eaf7f6">' . $contenido . '</td>'
        . '</tr>';
}

$html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">'
    . '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Nuevo contacto — On-Touch</title></head>'
    . '<body style="margin:0;padding:0;background:#04140f;font-family:Arial,sans-serif">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#04140f;padding:32px 16px">'
    . '<tr><td align="center">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#082521;border-radius:16px;overflow:hidden;border:1px solid rgba(218,251,252,.12)">'

    // Cabecera de marca
    . '<tr><td style="padding:26px 32px;background:linear-gradient(120deg,#127a77,#62b313 65%,#e2ee25);">'
    . '<span style="font-family:Arial,sans-serif;font-weight:800;font-size:20px;letter-spacing:.02em;color:#082521">ON&#9679;TOUCH</span>'
    . '</td></tr>'

    // Título
    . '<tr><td style="padding:28px 32px 4px">'
    . '<p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#e2ee25;font-weight:700">Nuevo contacto</p>'
    . '<h1 style="margin:0;font-family:Arial,sans-serif;font-size:22px;color:#eaf7f6">' . e($asunto) . '</h1>'
    . '</td></tr>'

    // Datos del contacto
    . '<tr><td style="padding:18px 32px 6px">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
    . filaDato('Empresa', $empresa)
    . filaDato('Correo', $email, 'mailto:' . $email)
    . filaDato('Teléfono', $telefono, $whatsappCliente ?? ($soloDigitos !== '' ? 'tel:' . $soloDigitos : null))
    . filaDato('Recibido', $fechaTexto)
    . '</table>'
    . '</td></tr>'

    // Mensaje
    . '<tr><td style="padding:22px 32px 6px">'
    . '<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:rgba(218,251,252,.55)">Mensaje</p>'
    . '<div style="padding:16px 18px;background:rgba(218,251,252,.05);border:1px solid rgba(218,251,252,.14);border-left:3px solid #62b313;border-radius:10px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#eaf7f6">'
    . nl2br_seguro($mensaje)
    . '</div>'
    . '</td></tr>'

    // Botones de respuesta rápida
    . '<tr><td style="padding:8px 32px 30px"><table role="presentation" cellpadding="0" cellspacing="0">' . $filaWhatsapp . '</table></td></tr>'

    // Pie
    . '<tr><td style="padding:16px 32px;background:rgba(4,20,18,.6);border-top:1px solid rgba(218,251,252,.1)">'
    . '<p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:rgba(218,251,252,.42)">Enviado automáticamente desde el formulario de contacto de on-touch.net</p>'
    . '</td></tr>'

    . '</table>'
    . '</td></tr>'
    . '</table>'
    . '</body></html>';

/* --------------------------------------------------------------------------
   Envío: multipart/alternative (texto plano + HTML) sin dependencias externas
   -------------------------------------------------------------------------- */

// El remitente debe ser un buzón del propio dominio; el correo del visitante
// va en Reply-To, nunca en From (así no lo marcan como falsificado).
$dominio = preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['SERVER_NAME'] ?? 'on-touch.net');
$limite = 'ontouch-' . bin2hex(random_bytes(12));

$cabeceras = implode("\r\n", [
    'From: Contacto web On-Touch <no-reply@' . $dominio . '>',
    'Reply-To: ' . $empresa . ' <' . $email . '>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' . $limite . '"',
    'X-Mailer: PHP/' . phpversion(),
]);

$cuerpo = "--{$limite}\r\n"
    . "Content-Type: text/plain; charset=UTF-8\r\n"
    . "Content-Transfer-Encoding: 8bit\r\n\r\n"
    . $textoPlano . "\r\n\r\n"
    . "--{$limite}\r\n"
    . "Content-Type: text/html; charset=UTF-8\r\n"
    . "Content-Transfer-Encoding: 8bit\r\n\r\n"
    . $html . "\r\n\r\n"
    . "--{$limite}--";

$asuntoCorreo = '=?UTF-8?B?' . base64_encode('Nuevo contacto web: ' . $asunto . ' — ' . $empresa) . '?=';

$enviado = mail(DESTINATARIO, $asuntoCorreo, $cuerpo, $cabeceras);

if ($enviado) {
    responder(true, 'Mensaje enviado. Te responderemos muy pronto.');
}

responder(false, 'No pudimos enviar el mensaje. Escríbenos por WhatsApp mientras lo revisamos.', 500);
