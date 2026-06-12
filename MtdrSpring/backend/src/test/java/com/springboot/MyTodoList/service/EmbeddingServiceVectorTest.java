package com.springboot.MyTodoList.service;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Arrays;

import org.junit.jupiter.api.Test;

class EmbeddingServiceVectorTest {

    @Test
    void normalizeEmbeddingVector_truncates3072To768() {
        double[] full = new double[3072];
        for (int i = 0; i < full.length; i++) {
            full[i] = i;
        }
        double[] out = EmbeddingService.normalizeEmbeddingVector(full, 768);
        assertEquals(768, out.length);
        assertArrayEquals(Arrays.copyOf(full, 768), out);
    }

    @Test
    void normalizeEmbeddingVector_rejectsTooShort() {
        assertThrows(IllegalStateException.class, () ->
            EmbeddingService.normalizeEmbeddingVector(new double[] { 1.0, 2.0 }, 768));
    }
}
