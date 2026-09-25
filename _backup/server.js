const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  message: { success:false, message: 'Demasiadas solicitudes. Intenta en 1 minuto.' }
});
app.use('/api/', limiter);

// Transporter SMTP - configura en .env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true', // true para 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { empresa = '', email = '', telefono = '', asunto = 'Contacto sitio web', mensaje = '' } = req.body;
    if (!email || !/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ success:false, message:'Email inválido.' });

    const mailOptions = {
      from: `"Contacto Web" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: process.env.TO_EMAIL || 'gerencia@on-touch.net',
      replyTo: email,
      subject: `Nuevo mensaje: ${asunto}`,
      html: `<h3>Contacto desde web</h3>
             <p><strong>Empresa:</strong> ${escapeHtml(empresa)}</p>
             <p><strong>Email:</strong> ${escapeHtml(email)}</p>
             <p><strong>Teléfono:</strong> ${escapeHtml(telefono)}</p>
             <p><strong>Asunto:</strong> ${escapeHtml(asunto)}</p>
             <p><strong>Mensaje:</strong><br/>${nl2br(escapeHtml(mensaje))}</p>`
    };

    await transporter.sendMail(mailOptions);
    return res.json({ success:true, message:'Mensaje enviado correctamente.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success:false, message:'Error al enviar el mensaje.' });
  }
});

function escapeHtml(text='') {
  return String(text).replace(/[&<>"'\/]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#47;'}[s]));
}
function nl2br(str){ return str.replace(/\n/g, '<br/>'); }

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));