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

    @Value("${telegram.bot.name:}")
    private String telegramBotUsername;

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

    /**
     * Notifies a developer they were assigned to a task.
     * Failures are logged only (does not throw) so task creation is not rolled back.
     */
    public void sendTaskAssignmentEmail(
            String toEmail,
            String assigneeName,
            String taskTitle,
            String priority,
            String sprintLabel,
            String assignedByName) {
        if (fromEmail == null || fromEmail.isEmpty()) {
            logger.warn("Task assignment email skipped: spring.mail.username is not configured");
            return;
        }
        if (toEmail == null || toEmail.isBlank()) {
            return;
        }

        try {
            String safeTitle = taskTitle != null ? taskTitle.trim() : "Untitled task";
            String safeName = assigneeName != null && !assigneeName.isBlank() ? assigneeName.trim() : "there";
            String safeAssigner =
                    assignedByName != null && !assignedByName.isBlank() ? assignedByName.trim() : "Your manager";
            String tasksUrl = frontendUrl != null ? frontendUrl.trim() : "";
            String botHandle = telegramBotUsername != null ? telegramBotUsername.trim().replace("@", "") : "";
            String telegramLine = buildTelegramInstructionPlain(botHandle);
            String telegramLineHtml = buildTelegramInstructionHtml(botHandle);

            String plainText = buildTaskAssignmentPlainText(
                    safeName, safeAssigner, safeTitle, priority, sprintLabel, tasksUrl, telegramLine);
            String html = buildTaskAssignmentHtml(
                    safeName, safeAssigner, safeTitle, priority, sprintLabel, tasksUrl, telegramLineHtml);

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail.trim());
            helper.setSubject("New task assigned — Oracle Task Manager");
            helper.setFrom(fromEmail);
            helper.setText(plainText, html);

            mailSender.send(message);
            logger.info(
                    "Task assignment email sent to {} (includes web portal + Telegram instructions)",
                    toEmail);
        } catch (Exception e) {
            logger.error("Failed to send task assignment email to {}: {}", toEmail, e.getMessage(), e);
        }
    }

    /**
     * Reminds a developer that an assigned task is due soon or overdue.
     * Failures are logged only (does not throw).
     */
    public void sendTaskDueReminderEmail(
            String toEmail,
            String assigneeName,
            String taskTitle,
            String dueLabel,
            String priority,
            String sprintLabel,
            String managerContact) {
        if (fromEmail == null || fromEmail.isEmpty()) {
            logger.warn("Task due reminder email skipped: spring.mail.username is not configured");
            return;
        }
        if (toEmail == null || toEmail.isBlank()) {
            return;
        }

        try {
            String safeName = assigneeName != null && !assigneeName.isBlank() ? assigneeName.trim() : "there";
            String safeTitle = taskTitle != null ? taskTitle.trim() : "Untitled task";
            String safeDue = dueLabel != null && !dueLabel.isBlank() ? dueLabel.trim() : "Due soon";
            String safeManager =
                    managerContact != null && !managerContact.isBlank()
                            ? managerContact.trim()
                            : "your manager";
            String portalUrl = frontendUrl != null ? frontendUrl.trim() : "";
            String botHandle = telegramBotUsername != null ? telegramBotUsername.trim().replace("@", "") : "";
            String telegramLine = buildTelegramInstructionPlain(botHandle);
            String telegramBlockersLine = buildTelegramBlockerInstructionPlain(botHandle);
            String telegramLineHtml = buildTelegramInstructionHtml(botHandle);
            String telegramBlockersLineHtml = buildTelegramBlockerInstructionHtml(botHandle);

            String plainText = buildTaskDueReminderPlainText(
                    safeName,
                    safeTitle,
                    safeDue,
                    priority,
                    sprintLabel,
                    safeManager,
                    portalUrl,
                    telegramLine,
                    telegramBlockersLine);
            String html = buildTaskDueReminderHtml(
                    safeName,
                    safeTitle,
                    safeDue,
                    priority,
                    sprintLabel,
                    safeManager,
                    portalUrl,
                    telegramLineHtml,
                    telegramBlockersLineHtml);

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail.trim());
            helper.setSubject("Task due soon — Oracle Task Manager");
            helper.setFrom(fromEmail);
            helper.setText(plainText, html);

            mailSender.send(message);
            logger.info("Task due reminder email sent to {}", toEmail);
        } catch (Exception e) {
            logger.error("Failed to send task due reminder email to {}: {}", toEmail, e.getMessage(), e);
        }
    }

    private static String buildTelegramBlockerInstructionPlain(String botHandle) {
        if (botHandle != null && !botHandle.isBlank()) {
            return "Report blockers in Telegram: open https://t.me/"
                    + botHandle
                    + " , sign in, and use My Blockers or tell your manager in the bot.";
        }
        return "Report blockers in Telegram: open your team's Task Manager bot, sign in, and use My Blockers.";
    }

    private static String buildTelegramBlockerInstructionHtml(String botHandle) {
        if (botHandle != null && !botHandle.isBlank()) {
            return "Report blockers in Telegram: open <a href=\"https://t.me/"
                    + escapeHtml(botHandle)
                    + "\" style=\"color:#0070f3\">@"
                    + escapeHtml(botHandle)
                    + "</a>, sign in, and use <strong>My Blockers</strong> or contact your manager in the bot.";
        }
        return "Report blockers in Telegram: open your team&rsquo;s Task Manager bot, sign in, and use "
                + "<strong>My Blockers</strong>.";
    }

    private static String buildTaskDueReminderPlainText(
            String assigneeName,
            String taskTitle,
            String dueLabel,
            String priority,
            String sprintLabel,
            String managerContact,
            String portalUrl,
            String telegramSignInLine,
            String telegramBlockersLine) {
        StringBuilder sb = new StringBuilder();
        sb.append("Task due soon\n\n");
        sb.append("Hi ").append(assigneeName).append(",\n\n");
        sb.append("Your assignment is approaching its due date:\n");
        sb.append(taskTitle).append("\n\n");
        sb.append("Due: ").append(dueLabel).append("\n");
        if (priority != null && !priority.isBlank()) {
            sb.append("Priority: ").append(priority.trim()).append("\n");
        }
        if (sprintLabel != null && !sprintLabel.isBlank()) {
            sb.append("Sprint: ").append(sprintLabel.trim()).append("\n");
        }
        sb.append("\n");
        sb.append("WHAT TO DO\n");
        sb.append("=========\n");
        sb.append("• If you are blocked or need help: ").append(telegramBlockersLine);
        sb.append("\n   Or contact your manager: ").append(managerContact).append("\n");
        sb.append("• If work is in progress: update your task status in the web portal (My Tasks) or Telegram.\n");
        sb.append("• If you finished the work: mark your assignment complete and log your worked hours if you have not yet.\n\n");
        sb.append("Web portal: sign in and open My Tasks");
        if (portalUrl != null && !portalUrl.isBlank()) {
            sb.append("\n").append(portalUrl);
        }
        sb.append("\nTelegram: ").append(telegramSignInLine).append("\n");
        return sb.toString();
    }

    private String buildTaskDueReminderHtml(
            String safeName,
            String safeTitle,
            String safeDue,
            String priority,
            String sprintLabel,
            String safeManager,
            String portalUrl,
            String telegramSignInHtml,
            String telegramBlockersHtml) {
        StringBuilder details = new StringBuilder();
        details.append("<p style='color:#444;margin:8px 0'><strong>Due:</strong> ")
                .append(escapeHtml(safeDue))
                .append("</p>");
        if (priority != null && !priority.isBlank()) {
            details.append("<p style='color:#444;margin:8px 0'><strong>Priority:</strong> ")
                    .append(escapeHtml(priority))
                    .append("</p>");
        }
        if (sprintLabel != null && !sprintLabel.isBlank()) {
            details.append("<p style='color:#444;margin:8px 0'><strong>Sprint:</strong> ")
                    .append(escapeHtml(sprintLabel))
                    .append("</p>");
        }

        String portalBlock =
                "<p style='color:#1a1a1a;margin:12px 0 8px 0'><strong>Web portal</strong></p>"
                        + "<p style='color:#444;margin:0 0 12px 0'>Sign in and open <strong>My Tasks</strong> to update status and hours"
                        + (portalUrl.isEmpty()
                                ? ".</p>"
                                : ": <a href=\""
                                        + escapeHtml(portalUrl)
                                        + "\" style=\"color:#0070f3\">"
                                        + escapeHtml(portalUrl)
                                        + "</a></p>");

        return "<div style='font-family:sans-serif;max-width:520px;margin:auto;padding:24px'>"
                + "<h2 style='color:#1a1a1a'>Task due soon</h2>"
                + "<p style='color:#444'>Hi "
                + escapeHtml(safeName)
                + ",</p>"
                + "<p style='color:#444'>Your assignment is approaching its due date:</p>"
                + "<p style='color:#1a1a1a;font-size:18px;font-weight:600;margin:16px 0'>"
                + escapeHtml(safeTitle)
                + "</p>"
                + details
                + "<div style='border:2px solid #E53935;border-radius:8px;padding:16px;margin:20px 0;background:#fff5f5'>"
                + "<p style='color:#1a1a1a;font-size:16px;font-weight:700;margin:0 0 12px 0'>What to do</p>"
                + "<ul style='color:#444;margin:0;padding-left:20px;line-height:1.6'>"
                + "<li><strong>Blocked or need help?</strong> "
                + telegramBlockersHtml
                + " Or contact your manager: <strong>"
                + escapeHtml(safeManager)
                + "</strong>.</li>"
                + "<li><strong>Work in progress?</strong> Update your task status in the portal or Telegram.</li>"
                + "<li><strong>Already done?</strong> Mark your assignment complete and log worked hours if you forgot.</li>"
                + "</ul>"
                + portalBlock
                + "<p style='color:#1a1a1a;margin:12px 0 8px 0'><strong>Telegram</strong></p>"
                + "<p style='color:#444;margin:0'>"
                + telegramSignInHtml
                + "</p>"
                + "</div>"
                + (portalUrl.isEmpty()
                        ? ""
                        : "<p style='margin:16px 0'><a href=\""
                                + escapeHtml(portalUrl)
                                + "\" style='display:inline-block;background:#E53935;color:#fff;"
                                + "padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold'>"
                                + "Open My Tasks</a></p>")
                + "<p style='color:#888;font-size:12px;margin-top:24px'>"
                + "You receive this reminder once per open assignment when the due date is near.</p>"
                + "</div>";
    }

    private static String buildTelegramInstructionPlain(String botHandle) {
        if (botHandle != null && !botHandle.isBlank()) {
            return "Telegram: open https://t.me/" + botHandle + " , send /start, and sign in.";
        }
        return "Telegram: open your team's Task Manager bot, send /start, and sign in.";
    }

    private static String buildTelegramInstructionHtml(String botHandle) {
        if (botHandle != null && !botHandle.isBlank()) {
            return "Open <a href=\"https://t.me/"
                    + escapeHtml(botHandle)
                    + "\" style=\"color:#0070f3\">@"
                    + escapeHtml(botHandle)
                    + "</a>, send <strong>/start</strong>, and sign in.";
        }
        return "Open your team&rsquo;s Task Manager bot, send <strong>/start</strong>, and sign in.";
    }

    private static String buildTaskAssignmentPlainText(
            String assigneeName,
            String assignerName,
            String taskTitle,
            String priority,
            String sprintLabel,
            String portalUrl,
            String telegramLine) {
        StringBuilder sb = new StringBuilder();
        sb.append("You have a new task\n\n");
        sb.append("Hi ").append(assigneeName).append(",\n\n");
        sb.append(assignerName).append(" assigned you to:\n");
        sb.append(taskTitle).append("\n\n");
        if (priority != null && !priority.isBlank()) {
            sb.append("Priority: ").append(priority.trim()).append("\n");
        }
        if (sprintLabel != null && !sprintLabel.isBlank()) {
            sb.append("Sprint: ").append(sprintLabel.trim()).append("\n");
        }
        sb.append("\n");
        sb.append("WHERE TO VIEW FULL TASK DETAILS (description, dates, status)\n");
        sb.append("============================================================\n");
        sb.append("1) Web portal: sign in and open My Tasks");
        if (portalUrl != null && !portalUrl.isBlank()) {
            sb.append("\n   ").append(portalUrl);
        }
        sb.append("\n2) ").append(telegramLine).append("\n");
        return sb.toString();
    }

    private String buildTaskAssignmentHtml(
            String safeName,
            String safeAssigner,
            String safeTitle,
            String priority,
            String sprintLabel,
            String tasksUrl,
            String telegramLineHtml) {
        StringBuilder details = new StringBuilder();
        if (priority != null && !priority.isBlank()) {
            details.append("<p style='color:#444;margin:8px 0'><strong>Priority:</strong> ")
                    .append(escapeHtml(priority))
                    .append("</p>");
        }
        if (sprintLabel != null && !sprintLabel.isBlank()) {
            details.append("<p style='color:#444;margin:8px 0'><strong>Sprint:</strong> ")
                    .append(escapeHtml(sprintLabel))
                    .append("</p>");
        }

        String portalBlock =
                "<p style='color:#1a1a1a;margin:12px 0 8px 0'><strong>1. Web portal</strong></p>"
                        + "<p style='color:#444;margin:0 0 12px 0'>Sign in and open <strong>My Tasks</strong>"
                        + (tasksUrl.isEmpty()
                                ? ".</p>"
                                : ": <a href=\""
                                        + escapeHtml(tasksUrl)
                                        + "\" style=\"color:#0070f3\">"
                                        + escapeHtml(tasksUrl)
                                        + "</a></p>");

        String telegramBlock =
                "<p style='color:#1a1a1a;margin:12px 0 8px 0'><strong>2. Telegram</strong></p>"
                        + "<p style='color:#444;margin:0'>"
                        + telegramLineHtml
                        + "</p>";

        return "<div style='font-family:sans-serif;max-width:520px;margin:auto;padding:24px'>"
                + "<h2 style='color:#1a1a1a'>You have a new task</h2>"
                + "<p style='color:#444'>Hi "
                + escapeHtml(safeName)
                + ",</p>"
                + "<p style='color:#444'><strong>"
                + escapeHtml(safeAssigner)
                + "</strong> assigned you to:</p>"
                + "<p style='color:#1a1a1a;font-size:18px;font-weight:600;margin:16px 0'>"
                + escapeHtml(safeTitle)
                + "</p>"
                + details
                + "<div style='border:2px solid #0070f3;border-radius:8px;padding:16px;margin:20px 0;background:#f0f7ff'>"
                + "<p style='color:#1a1a1a;font-size:16px;font-weight:700;margin:0 0 12px 0'>"
                + "Where to view full task details</p>"
                + "<p style='color:#555;margin:0 0 12px 0;font-size:14px'>"
                + "Description, dates, and status:</p>"
                + portalBlock
                + telegramBlock
                + "</div>"
                + (tasksUrl.isEmpty()
                        ? ""
                        : "<p style='margin:16px 0'><a href=\""
                                + escapeHtml(tasksUrl)
                                + "\" style='display:inline-block;background:#0070f3;color:#fff;"
                                + "padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold'>"
                                + "Open web portal</a></p>")
                + "<p style='color:#888;font-size:12px;margin-top:24px'>"
                + "If you were not expecting this assignment, contact your manager.</p>"
                + "</div>";
    }

    private static String escapeHtml(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}