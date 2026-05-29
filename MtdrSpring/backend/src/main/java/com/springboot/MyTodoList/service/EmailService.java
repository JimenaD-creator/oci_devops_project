package com.springboot.MyTodoList.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;

@Service
public class EmailService {

    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);

    @Autowired
    private JavaMailSender mailSender;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    @Value("${spring.mail.username}")
    private String fromEmail;

    public void sendPasswordResetEmail(String toEmail, String token) {
        logger.info("========================================");
        logger.info("📧 INICIANDO ENVÍO DE EMAIL DE RECUPERACIÓN");
        logger.info("========================================");
        
        try {
            // Log de parámetros de entrada
            logger.info("📨 Destinatario: {}", toEmail);
            logger.info("🔑 Token generado: {}", token);
            logger.info("🌐 Frontend URL configurada: {}", frontendUrl);
            logger.info("📧 Email remitente configurado: {}", fromEmail);
            
            // Verificar que el remitente no esté vacío
            if (fromEmail == null || fromEmail.isEmpty()) {
                logger.error("❌ ERROR: spring.mail.username no está configurado en application.properties");
                throw new RuntimeException("Email remitente no configurado");
            }
            
            // Verificar que el token no esté vacío
            if (token == null || token.isEmpty()) {
                logger.error("❌ ERROR: El token está vacío");
                throw new RuntimeException("Token de recuperación vacío");
            }
            
            MimeMessage message = mailSender.createMimeMessage();
            logger.info("✅ MimeMessage creado correctamente");
            
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            logger.info("✅ MimeMessageHelper creado correctamente");

            helper.setTo(toEmail);
            helper.setSubject("Password recovery - Oracle Task Manager");
            helper.setFrom(fromEmail);
            logger.info("✅ Destinatario, asunto y remitente configurados");

            String resetLink = frontendUrl + "/reset-password?token=" + token;
            logger.info("🔗 Link de recuperación generado: {}", resetLink);

            String html = "<div style='font-family:sans-serif;max-width:480px;margin:auto;padding:24px'>"
                + "<h2 style='color:#1a1a1a'>Reset your password</h2>"
                + "<p style='color:#444'>We received a request to reset your password.</p>"
                + "<p style='color:#444'>Click the button below to choose a new password:</p>"
                + "<a href='" + resetLink + "' style='display:inline-block;background:#0070f3;"
                + "color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;"
                + "font-weight:bold;margin:16px 0'>Reset password</a>"
                + "<p style='color:#888;font-size:12px;margin-top:24px'>This link expires in 1 hour.<br>"
                + "If you did not request this, you can ignore this email.</p>"
                + "</div>";
            
            logger.info("📝 Contenido HTML del email generado (primeros 200 chars): {}", 
                html.length() > 200 ? html.substring(0, 200) + "..." : html);

            helper.setText(html, true);
            logger.info("✅ Contenido HTML agregado al mensaje");

            logger.info("🚀 Intentando enviar el email...");
            mailSender.send(message);
            
            logger.info("========================================");
            logger.info("✅ ¡EMAIL ENVIADO EXITOSAMENTE! a {}", toEmail);
            logger.info("========================================");
            
            // Log adicional para verificar en Gmail
            logger.info("💡 Verifica en tu cuenta de Gmail ({}) la carpeta 'Enviados'", fromEmail);
            logger.info("💡 Si no ves el email, revisa los logs de error arriba");

        } catch (Exception e) {
            logger.error("========================================");
            logger.error("❌ ERROR AL ENVIAR EMAIL DE RECUPERACIÓN");
            logger.error("========================================");
            logger.error("📨 Destinatario: {}", toEmail);
            logger.error("🔑 Token: {}", token);
            logger.error("❌ Tipo de error: {}", e.getClass().getSimpleName());
            logger.error("❌ Mensaje de error: {}", e.getMessage());
            
            // Log del stack trace completo
            logger.error("📚 Stack trace completo:", e);
            
            // Errores comunes y sus soluciones
            if (e.getMessage().contains("Authentication failed")) {
                logger.error("🔧 SOLUCIÓN: La contraseña de aplicación es incorrecta. Genera una nueva en: https://myaccount.google.com/apppasswords");
            } else if (e.getMessage().contains("Invalid Addresses")) {
                logger.error("🔧 SOLUCIÓN: El email del destinatario o remitente no es válido. Verifica: to={}, from={}", toEmail, fromEmail);
            } else if (e.getMessage().contains("Connection refused") || e.getMessage().contains("timeout")) {
                logger.error("🔧 SOLUCIÓN: Problema de conexión con el servidor SMTP. Verifica host y puerto en application.properties");
            } else if (e.getMessage().contains("Mail server connection failed")) {
                logger.error("🔧 SOLUCIÓN: No se puede conectar al servidor de correo. Verifica tu conexión a internet y configuración SMTP");
            }
            
            logger.error("========================================");
            throw new RuntimeException("Error al enviar email: " + e.getMessage(), e);
        }
    }
}