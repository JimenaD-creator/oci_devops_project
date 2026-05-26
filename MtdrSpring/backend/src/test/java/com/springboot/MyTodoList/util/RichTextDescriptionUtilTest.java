package com.springboot.MyTodoList.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class RichTextDescriptionUtilTest {

    @Test
    void toPlainText_returnsPlainTextWhenNoHtml() {
        assertEquals("Implement login flow", RichTextDescriptionUtil.toPlainText("Implement login flow"));
    }

    @Test
    void toPlainText_stripsBasicHtmlAndPreservesLineBreaks() {
        String html = "<p><b>Goal</b></p><p>Fix the <i>API</i> endpoint<br>and update tests.</p>";
        assertEquals("Goal\nFix the API endpoint\nand update tests.", RichTextDescriptionUtil.toPlainText(html));
    }

    @Test
    void toPlainText_formatsLists() {
        String html = "<ul><li>First item</li><li>Second item</li></ul>";
        assertEquals("• First item\n• Second item", RichTextDescriptionUtil.toPlainText(html));
    }

    @Test
    void toPlainText_decodesEntities() {
        assertEquals("Tom & Jerry", RichTextDescriptionUtil.toPlainText("<p>Tom &amp; Jerry</p>"));
    }

    @Test
    void toPlainTextSingleLine_collapsesWhitespace() {
        String html = "<p>Line one</p><p>Line two</p>";
        assertEquals("Line one Line two", RichTextDescriptionUtil.toPlainTextSingleLine(html));
    }

    @Test
    void looksLikeRichDescriptionHtml_detectsTags() {
        assertTrue(RichTextDescriptionUtil.looksLikeRichDescriptionHtml("<p>Hi</p>"));
        assertFalse(RichTextDescriptionUtil.looksLikeRichDescriptionHtml("plain text"));
    }
}
