package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.config.BotProps;
import com.springboot.MyTodoList.service.DeepSeekService;
import com.springboot.MyTodoList.service.GeminiService;
import com.springboot.MyTodoList.service.SprintService;
import com.springboot.MyTodoList.service.ToDoItemService;
import com.springboot.MyTodoList.service.TelegramUserMappingService;
import com.springboot.MyTodoList.service.UserService;
import com.springboot.MyTodoList.service.UserTaskService;
import com.springboot.MyTodoList.util.BotActions;
import com.springboot.MyTodoList.util.BotStateManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.telegram.telegrambots.client.okhttp.OkHttpTelegramClient;
import org.telegram.telegrambots.longpolling.BotSession;
import org.telegram.telegrambots.longpolling.interfaces.LongPollingUpdateConsumer;
import org.telegram.telegrambots.longpolling.starter.AfterBotRegistration;
import org.telegram.telegrambots.longpolling.starter.SpringLongPollingBot;
import org.telegram.telegrambots.longpolling.util.LongPollingSingleThreadUpdateConsumer;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.generics.TelegramClient;

@Component
public class ToDoItemBotController implements SpringLongPollingBot, LongPollingSingleThreadUpdateConsumer {

    private static final Logger logger = LoggerFactory.getLogger(ToDoItemBotController.class);
    private ToDoItemService toDoItemService;
    private DeepSeekService deepSeekService;
    private SprintService sprintService;
    private final TelegramClient telegramClient;
    private final BotProps botProps;
    private BotStateManager stateManager;
    private TelegramUserMappingService telegramUserMappingService;
    private UserTaskService userTaskService;
    private UserService userService;
    private GeminiService geminiService;

    @Override
    public String getBotToken() {
        return botProps.getToken();
    }

    public ToDoItemBotController(
            BotProps bp,
            ToDoItemService tsvc,
            DeepSeekService ds,
            SprintService ss,
            BotStateManager stateManager,
            TelegramUserMappingService telegramUserMappingService,
            UserTaskService userTaskService,
            UserService userService,
            GeminiService geminiService
    ) {
        this.botProps = bp;
        this.toDoItemService = tsvc;
        this.deepSeekService = ds;
        this.sprintService = ss;
        this.stateManager = stateManager;
        this.telegramUserMappingService = telegramUserMappingService;
        this.userTaskService = userTaskService;
        this.userService = userService;
        this.geminiService = geminiService;
        this.telegramClient = new OkHttpTelegramClient(getBotToken());
    }

    @Override
    public LongPollingUpdateConsumer getUpdatesConsumer() {
        return this;
    }

    @Override
    public void consume(Update update) {
        if (!update.hasMessage() || !update.getMessage().hasText()) return;

        String messageTextFromTelegram = update.getMessage().getText();
        long chatId = update.getMessage().getChatId();

        logger.info("=== BOT MESSAGE RECEIVED ===");
        logger.info("ChatId: {}, Message: '{}'", chatId, messageTextFromTelegram);
        logger.info("Current State: {}", stateManager.getState(chatId));

        BotActions actions = new BotActions(
                telegramClient,
                toDoItemService,
                deepSeekService,
                stateManager,
                telegramUserMappingService,
                userTaskService,
                sprintService,
                userService,
                geminiService
        );
        actions.setRequestText(messageTextFromTelegram);
        actions.setChatId(chatId);

        if (actions.getTodoService() == null) {
            logger.info("todosvc error");
            actions.setTodoService(toDoItemService);
        }

        // ========================================================================
        // ORDEN CORRECTO DE HANDLERS
        // ========================================================================
        
        // 1. Comandos de autenticación y navegación principal
        actions.fnStart();
        actions.fnSessionLogin();
        actions.fnLogOut();
        
        // 2. MY PERFORMANCE (DEBE IR ANTES que fnElse y fnAddItem)
        actions.fnMyPerformance();
        actions.fnSelectMyPerformanceScope();
        
        // 3. Sprint y tareas
        actions.fnListAll();
        actions.fnSelectSprint();
        actions.fnSelectUserInSprint();
        actions.fnVerifyCredentialsPhoneEmail();
        actions.fnVerifyCredentialsPassword();
        actions.fnViewSprintTasks();
        actions.fnSelectTaskStatus();
        
        // 4. Acciones de tareas individuales
        actions.fnDone();
        actions.fnUndo();
        actions.fnDelete();
        actions.fnAddItem();
        
        // 5. Otros comandos
        actions.fnHide();
        actions.fnLLM();
        
        // 6. AL FINAL: fnElse (captura texto libre para crear nuevas tareas)
        //    Este handler debe ser el ÚLTIMO porque cualquier texto no reconocido
        //    por los handlers anteriores creará una nueva tarea.
        actions.fnElse();

        logger.info("=== BOT HANDLERS COMPLETE ===");
    }

    @AfterBotRegistration
    public void afterRegistration(BotSession botSession) {
        System.out.println("Registered bot running state is: " + botSession.isRunning());
    }
}