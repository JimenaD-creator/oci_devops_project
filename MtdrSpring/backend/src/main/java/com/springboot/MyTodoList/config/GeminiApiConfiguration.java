package com.springboot.MyTodoList.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Single source of truth for Gemini API key presence (insights, manager chat, embeddings).
 */
@Component
public class GeminiApiConfiguration {

    public static final String ERROR_CODE = "API_KEY_MISSING";

    public static final String USER_MESSAGE =
        "Gemini API key is not configured on the server";

    @Value("${gemini.api.key:}")
    private String apiKey;

    @PostConstruct
    void logStartupStatus() {
        if (!isConfigured()) {
            System.err.println(
                "[Gemini] GEMINI_API_KEY is missing — sprint insights generation, manager chat, "
                    + "and task embeddings cannot call Gemini until it is set.");
        }
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public String getApiKey() {
        return apiKey;
    }

    public void requireConfigured() {
        if (!isConfigured()) {
            throw new IllegalStateException(USER_MESSAGE);
        }
    }
}
