package com.springboot.MyTodoList.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class WorkedHoursUtilTest {

    @Test
    void parseBotInput_acceptsDecimalsAndComma() throws Exception {
        assertEquals(1.5, WorkedHoursUtil.parseBotInput("1.5"), 0.001);
        assertEquals(1.5, WorkedHoursUtil.parseBotInput("1,5"), 0.001);
        assertEquals(2.0, WorkedHoursUtil.parseBotInput("2"), 0.001);
        assertEquals(0.25, WorkedHoursUtil.parseBotInput("0.25"), 0.001);
    }

    @Test
    void parseBotInput_rejectsInvalid() {
        assertThrows(NumberFormatException.class, () -> WorkedHoursUtil.parseBotInput("abc"));
    }

    @Test
    void validateRange_enforcesMinMax() {
        assertNull(WorkedHoursUtil.validateRange(1.5));
        assertNull(WorkedHoursUtil.validateRange(0.1));
        assertEquals(
                "Hours must be at least 0.1. Please try again.",
                WorkedHoursUtil.validateRange(0.05));
    }

    @Test
    void formatForDisplay_omitsTrailingZeros() {
        assertEquals("2", WorkedHoursUtil.formatForDisplay(2.0));
        assertEquals("1.5", WorkedHoursUtil.formatForDisplay(1.5));
        assertEquals("0.25", WorkedHoursUtil.formatForDisplay(0.25));
    }
}
