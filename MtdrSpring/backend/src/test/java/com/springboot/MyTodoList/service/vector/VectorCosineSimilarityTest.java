package com.springboot.MyTodoList.service.vector;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VectorCosineSimilarityTest {

    @Test
    void identicalVectorsHaveSimilarityOne() {
        double[] v = {1.0, 0.0, 0.0};
        assertEquals(1.0, VectorCosineSimilarity.cosineSimilarity(v, v), 1e-9);
    }

    @Test
    void orthogonalVectorsHaveSimilarityZero() {
        double[] a = {1.0, 0.0};
        double[] b = {0.0, 1.0};
        assertEquals(0.0, VectorCosineSimilarity.cosineSimilarity(a, b), 1e-9);
    }

    @Test
    void nullOrMismatchedLengthsReturnZero() {
        assertEquals(0.0, VectorCosineSimilarity.cosineSimilarity(null, new double[] {1}));
        assertEquals(0.0, VectorCosineSimilarity.cosineSimilarity(new double[] {1}, new double[] {1, 2}));
    }

    @Test
    void similarVectorsScoreHigh() {
        double[] a = {0.9, 0.1, 0.0};
        double[] b = {0.8, 0.2, 0.0};
        assertTrue(VectorCosineSimilarity.cosineSimilarity(a, b) > 0.95);
    }
}
