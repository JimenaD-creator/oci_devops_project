package com.springboot.MyTodoList.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ManagerChatReplyUtilTest {

    @Test
    void alignProductivityScore_keepsSprintNumber_notScore() {
        String input = "The productivity score for Sprint 4 is 68.";
        String out = ManagerChatReplyUtil.alignProductivityScoreMentions(input, 72);
        assertEquals("The productivity score for Sprint 4 is 72%.", out);
    }

    @Test
    void alignProductivityScore_withoutSprintLabel() {
        String input = "The productivity score is 68";
        String out = ManagerChatReplyUtil.alignProductivityScoreMentions(input, 72);
        assertEquals("The productivity score is 72%", out);
    }

    @Test
    void alignProductivityScore_doesNotTouchUnrelatedNumbers() {
        String input = "Sprint 4 has 12 tasks.";
        String out = ManagerChatReplyUtil.alignProductivityScoreMentions(input, 72);
        assertEquals(input, out);
    }
}
