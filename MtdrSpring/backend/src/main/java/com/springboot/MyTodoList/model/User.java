package com.springboot.MyTodoList.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "USERS")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID")
    private Long id;

    @Column(name = "NAME")
    private String name;

    @Column(name = "EMAIL")
    private String email;

    @Column(name = "TYPE")
    private String type;

    @Column(name = "PHONENUMBER")
    private String phonenumber;

    @Column(name = "PASSWORD")
    private String userpassword;

    public User() {}

    public User(Long id, String number, String password) {
        this.id = id;
        this.phonenumber = number;
        this.userpassword = password;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    @JsonIgnore
    public int getID() {
        return id != null ? id.intValue() : 0;
    }

    @JsonIgnore
    public void setID(int ID) {
        this.id = (long) ID;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhoneNumber() {
        return phonenumber;
    }

    public void setPhoneNumber(String number) {
        this.phonenumber = number;
    }

    public String getUserPassword() {
        return userpassword;
    }

    public void setUserPassword(String password) {
        this.userpassword = password;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}