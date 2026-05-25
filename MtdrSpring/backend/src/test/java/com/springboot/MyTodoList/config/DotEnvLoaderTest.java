package com.springboot.MyTodoList.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class DotEnvLoaderTest {

    @TempDir
    Path tempDir;

    @Test
    void loadIntoSystemProperties_readsEnvFile() throws Exception {
        Path envFile = tempDir.resolve(".env");
        Files.writeString(envFile, "GEMINI_API_KEY=test-key-from-dotenv\n# comment\nFOO=bar\n");

        String prevUserDir = System.getProperty("user.dir");
        String prevKey = System.getProperty("GEMINI_API_KEY");
        try {
            System.setProperty("user.dir", tempDir.toString());
            System.clearProperty("GEMINI_API_KEY");
            DotEnvLoader.loadIntoSystemProperties();
            assertEquals("test-key-from-dotenv", System.getProperty("GEMINI_API_KEY"));
        } finally {
            System.setProperty("user.dir", prevUserDir);
            if (prevKey != null) {
                System.setProperty("GEMINI_API_KEY", prevKey);
            } else {
                System.clearProperty("GEMINI_API_KEY");
            }
        }
    }
}
