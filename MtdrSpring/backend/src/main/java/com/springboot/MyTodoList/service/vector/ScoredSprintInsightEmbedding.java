package com.springboot.MyTodoList.service.vector;

import com.springboot.MyTodoList.model.SprintInsightEmbedding;

/** Sprint insight row ranked by cosine similarity (1.0 = identical). */
public class ScoredSprintInsightEmbedding {

    private final SprintInsightEmbedding embedding;
    private final double similarity;

    public ScoredSprintInsightEmbedding(SprintInsightEmbedding embedding, double similarity) {
        this.embedding = embedding;
        this.similarity = similarity;
    }

    public SprintInsightEmbedding getEmbedding() {
        return embedding;
    }

    public double getSimilarity() {
        return similarity;
    }
}
