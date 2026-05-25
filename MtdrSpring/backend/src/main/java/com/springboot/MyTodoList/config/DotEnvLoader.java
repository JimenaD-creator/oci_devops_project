package com.springboot.MyTodoList.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Loads {@code GEMINI_API_KEY} and other vars from {@code .env} before Spring starts.
 * Spring Boot does not read {@code .env} by itself; IDE runs often use a cwd where only
 * {@code MtdrSpring/backend/.env} exists.
 */
public final class DotEnvLoader {

    private DotEnvLoader() {}

    public static void loadIntoSystemProperties() {
        Set<Path> candidates = new LinkedHashSet<>();
        Path cwd = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();

        candidates.add(cwd.resolve(".env"));
        candidates.add(cwd.resolve("MtdrSpring").resolve("backend").resolve(".env"));
        candidates.add(cwd.resolve("backend").resolve(".env"));

        if (cwd.getFileName() != null && "backend".equals(cwd.getFileName().toString())) {
            candidates.add(cwd.getParent().resolve(".env"));
        }

        List<Path> tried = new ArrayList<>();
        for (Path path : candidates) {
            tried.add(path);
            if (!Files.isRegularFile(path)) {
                continue;
            }
            try {
                int loaded = parseAndApply(path);
                System.out.println("[DotEnv] Loaded " + loaded + " entries from " + path);
                return;
            } catch (IOException e) {
                System.err.println("[DotEnv] Failed to read " + path + ": " + e.getMessage());
            }
        }
        System.out.println("[DotEnv] No .env file found. Tried: " + tried);
    }

    private static int parseAndApply(Path path) throws IOException {
        int count = 0;
        for (String rawLine : Files.readAllLines(path)) {
            String line = rawLine.trim();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            if (line.regionMatches(true, 0, "export ", 0, 7)) {
                line = line.substring(7).trim();
            }
            int eq = line.indexOf('=');
            if (eq <= 0) {
                continue;
            }
            String key = line.substring(0, eq).trim();
            String value = stripQuotes(line.substring(eq + 1).trim());
            if (key.isEmpty()) {
                continue;
            }
            // Do not override explicit OS env or JVM -D flags
            if (System.getenv(key) != null) {
                continue;
            }
            if (System.getProperty(key) != null) {
                continue;
            }
            System.setProperty(key, value);
            count++;
        }
        return count;
    }

    private static String stripQuotes(String value) {
        if (value.length() >= 2) {
            char first = value.charAt(0);
            char last = value.charAt(value.length() - 1);
            if ((first == '"' && last == '"') || (first == '\'' && last == '\'')) {
                return value.substring(1, value.length() - 1);
            }
        }
        return value;
    }
}
