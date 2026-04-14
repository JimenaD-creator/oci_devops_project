package com.springboot.MyTodoList.model;
import jakarta.persistence.*;

@Entity
@Table(name = "USERS")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    int ID;

    @Column(name = "NAME")
    private String name;

    @Column(name = "EMAIL")
    private String email;

    @Column(name = "TYPE")
    private String type;

    @Column(name = "PHONENUMBER")
    String phonenumber;

    @Column(name = "PASSWORD")
    String userpassword;

    public User() {}

    public User(int ID, String number, String password) {
        this.ID = ID;
        this.phonenumber = number;
        this.userpassword = password;
    }

    public int getID() { return ID; }
    public void setID(int ID) { this.ID = ID; }

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
}