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

    @Value("${gemini.api.url:https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent}")
    private String apiUrl;

    @PostConstruct
    void logStartupStatus() {
        if (!isConfigured()) {
            System.err.println(
                "[Gemini] GEMINI_API_KEY is missing — sprint insights generation, manager chat, "
                    + "and task embeddings cannot call Gemini until it is set.");
        } else {
            System.out.println("[Gemini] API key loaded (length=" + apiKey.length() + ")");
            System.out.println("[Gemini] generateContent endpoint: " + apiUrl);
        }
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public String getApiKey() {
        return apiKey;
    }

    /** Full REST URL for {@code :generateContent} (includes model id). */
    public String getApiUrl() {
        return apiUrl;
    }

    public void requireConfigured() {
        if (!isConfigured()) {
            throw new IllegalStateException(USER_MESSAGE);
        }
    }
}
