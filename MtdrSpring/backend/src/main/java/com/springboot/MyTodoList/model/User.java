package com.springboot.MyTodoList.model;

import jakarta.persistence.*;

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

    @Column(name = "PROFILE_PICTURE", columnDefinition = "CLOB")
    private String profilePicture;

    public User() {}

    public User(Long id, String number, String password) {
        this.id = id;
        this.phonenumber = number;
        this.userpassword = password;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhoneNumber() { return phonenumber; }
    public void setPhoneNumber(String number) { this.phonenumber = number; }

    public String getUserPassword() { return userpassword; }
    public void setUserPassword(String password) { this.userpassword = password; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getProfilePicture() { return profilePicture; }
    public void setProfilePicture(String profilePicture) { this.profilePicture = profilePicture; }
}