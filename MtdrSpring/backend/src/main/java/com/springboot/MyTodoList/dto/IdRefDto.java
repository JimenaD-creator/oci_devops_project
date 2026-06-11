package com.springboot.MyTodoList.dto;

public class IdRefDto {
    private Long id;

    public IdRefDto() {}

    public IdRefDto(Long id) {
        this.id = id;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }
}
