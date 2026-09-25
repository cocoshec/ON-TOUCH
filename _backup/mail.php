<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $empresa = $_POST['empresa'];
    $email = $_POST['email'];
    $telefono = $_POST['telefono'];
    $asunto = $_POST['asunto'];
    $mensaje = $_POST['mensaje'];

    // Validación simple
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo "Email inválido.";
        exit;
    }

    // Configuración del correo
    $recipient = "jeanjuegajuegos1@gmail.com"; // Cambia esto por tu dirección de correo
    $subject = "Nuevo mensaje de contacto: " . $asunto;
    $body = "Empresa: $empresa\nEmail: $email\nTeléfono: $telefono\nMensaje:\n$mensaje";
    $headers = "From: $email\r\n";

    // Enviar correo
    if (mail($recipient, $subject, $body, $headers)) {
        echo "Mensaje enviado correctamente.";
    } else {
        echo "Error al enviar el mensaje.";
    }
} else {
    echo "Método de solicitud no válido.";
}
?>