package com.springboot.MyTodoList.util;

import java.util.regex.Pattern;

/**
 * Converts rich-text task descriptions (HTML from the web editor) to plain text for Telegram,
 * aligned with {@code richTextDescriptionUtils.js} on the frontend.
 */
public final class RichTextDescriptionUtil {

    private static final Pattern HTML_TAG = Pattern.compile("<[^>]+>", Pattern.CASE_INSENSITIVE);
    private static final Pattern LOOKS_LIKE_HTML = Pattern.compile("<[a-z][\\s\\S]*>", Pattern.CASE_INSENSITIVE);

    private RichTextDescriptionUtil() {
    }

    public static boolean looksLikeRichDescriptionHtml(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        return LOOKS_LIKE_HTML.matcher(value.trim()).find();
    }

    public static String toPlainText(String value) {
        if (value == null) {
            return "";
        }
        String raw = value.trim();
        if (raw.isEmpty()) {
            return "";
        }
        if (!looksLikeRichDescriptionHtml(raw)) {
            return raw;
        }

        String text = decodeBasicEntities(raw);
        text = text.replaceAll("(?i)<br\\s*/?>", "\n");
        text = text.replaceAll("(?i)<li[^>]*>", "\n• ");
        text = text.replaceAll("(?i)</li>", "");
        text = text.replaceAll("(?i)</p>", "\n");
        text = text.replaceAll("(?i)</div>", "\n");
        text = text.replaceAll("(?i)</h[1-6]>", "\n");
        text = HTML_TAG.matcher(text).replaceAll(" ");
        return normalizeMultiline(text);
    }

    public static String toPlainTextSingleLine(String value) {
        String plain = toPlainText(value);
        if (plain.isEmpty()) {
            return "";
        }
        return plain.replace('\n', ' ').replaceAll("\\s+", " ").trim();
    }

    private static String decodeBasicEntities(String input) {
        return input
                .replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&apos;", "'");
    }

    private static String normalizeMultiline(String text) {
        String[] lines = text.split("\\r?\\n");
        StringBuilder sb = new StringBuilder();
        for (String line : lines) {
            String trimmed = line.replaceAll("\\s+", " ").trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append('\n');
            }
            sb.append(trimmed);
        }
        return sb.toString();
    }
}
