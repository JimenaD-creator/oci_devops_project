package com.springboot.MyTodoList.controller;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@CrossOrigin(origins = "http://localhost:3000")
public class UserController {
    @Autowired
    private UserService userService;

    @GetMapping(value = "/users")
    public List<User> getAllUsers(){
        return userService.findAll();
    }

    @GetMapping(value = "/users/{id}")
    public ResponseEntity<User> getUserById(@PathVariable int id){
        try{
            ResponseEntity<User> responseEntity = userService.getUserById(id);
            return new ResponseEntity<User>(responseEntity.getBody(), HttpStatus.OK);
        }catch (Exception e){
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
    }

    @PostMapping(value = "/adduser")
    public ResponseEntity<User> addUser(@RequestBody User newUser) throws Exception{
        User dbUser = userService.addUser(newUser);
        HttpHeaders responseHeaders = new HttpHeaders();
        responseHeaders.set("location",""+dbUser.getID());
        responseHeaders.set("Access-Control-Expose-Headers","location");

        return ResponseEntity.ok()
                .headers(responseHeaders).build();
    }

    @PutMapping(value = "updateUser/{id}")
    public ResponseEntity<User> updateUser(@RequestBody User user, @PathVariable int id){
        try{
            User dbUser = userService.updateUser(id, user);
            return new ResponseEntity<>(dbUser,HttpStatus.OK);
        }catch (Exception e){
            return new ResponseEntity<>(null, HttpStatus.NOT_FOUND);
        }
    }

    @DeleteMapping(value = "deleteUser/{id}")
    public ResponseEntity<Boolean> deleteUser(@PathVariable("id") int id){
        Boolean flag = false;
        try{
            flag = userService.deleteUser(id);
            return new ResponseEntity<>(flag, HttpStatus.OK);
        }catch (Exception e){
            return new ResponseEntity<>(flag,HttpStatus.NOT_FOUND);
        }
    }

    @GetMapping(value = "/unitTestAdd")
    public User test(){
        return userService.test();
    }
}