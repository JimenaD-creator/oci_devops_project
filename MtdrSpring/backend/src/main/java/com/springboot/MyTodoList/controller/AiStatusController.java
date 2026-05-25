package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.config.GeminiApiConfiguration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Lets the UI disable AI actions before the user hits generate/chat.
 */
@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "*")
public class AiStatusController {

    private final GeminiApiConfiguration geminiApiConfiguration;

    @Value("${deepseek.api.key:}")
    private String deepSeekApiKey;

    public AiStatusController(GeminiApiConfiguration geminiApiConfiguration) {
        this.geminiApiConfiguration = geminiApiConfiguration;
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        boolean geminiOk = geminiApiConfiguration.isConfigured();
        boolean deepSeekOk = deepSeekApiKey != null && !deepSeekApiKey.isBlank()
            && !"sk-test".equals(deepSeekApiKey.trim());

        Map<String, Object> gemini = new LinkedHashMap<>();
        gemini.put("configured", geminiOk);
        if (!geminiOk) {
            gemini.put("errorCode", GeminiApiConfiguration.ERROR_CODE);
            gemini.put("message", GeminiApiConfiguration.USER_MESSAGE);
        }

        Map<String, Object> deepseek = new LinkedHashMap<>();
        deepseek.put("configured", deepSeekOk);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("gemini", gemini);
        body.put("deepseek", deepseek);
        body.put("insightsAvailable", geminiOk);
        body.put("managerChatAvailable", geminiOk);
        return ResponseEntity.ok(body);
    }
}
