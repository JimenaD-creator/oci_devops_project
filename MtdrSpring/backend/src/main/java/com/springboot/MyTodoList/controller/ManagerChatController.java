package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.model.ManagerChatRequest;
import com.springboot.MyTodoList.model.ManagerChatResponse;
import com.springboot.MyTodoList.service.ManagerChatService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chat")
@CrossOrigin(origins = "*")
public class ManagerChatController {

    @Autowired
    private ManagerChatService managerChatService;

    /**
     * POST /api/chat/manager
     *
     * Body:
     * {
     *   "projectId": 1,
     *   "sprintId": 3,          // optional — null = all sprints
     *   "message": "How many tasks did Erick complete?",
     *   "history": [            // optional — previous turns for multi-turn chat
     *     { "role": "user", "content": "..." },
     *     { "role": "assistant", "content": "..." }
     *   ]
     * }
     */
    @PostMapping("/manager")
    public ResponseEntity<ManagerChatResponse> chat(@RequestBody ManagerChatRequest request) {
        ManagerChatResponse response = managerChatService.chat(request);
        if (response.isError()) {
            return ResponseEntity.status(422).body(response);
        }
        return ResponseEntity.ok(response);
    }
}