package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.config.BotProps;
import com.springboot.MyTodoList.repository.TeamMembersRepository;
import com.springboot.MyTodoList.repository.TeamRepository;
import com.springboot.MyTodoList.service.DeepSeekService;
import com.springboot.MyTodoList.service.GeminiService;
import com.springboot.MyTodoList.service.ProjectLookupService;
import com.springboot.MyTodoList.service.SprintService;
import com.springboot.MyTodoList.service.ToDoItemService;
import com.springboot.MyTodoList.service.TelegramUserMappingService;
import com.springboot.MyTodoList.service.UserService;
import com.springboot.MyTodoList.service.UserTaskService;
import com.springboot.MyTodoList.util.BotActions;
import com.springboot.MyTodoList.util.BotHelper;
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
    private ProjectLookupService projectLookupService;
    private TeamRepository teamRepository;
    private TeamMembersRepository teamMembersRepository;

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
            GeminiService geminiService,
            ProjectLookupService projectLookupService,
            TeamRepository teamRepository,
            TeamMembersRepository teamMembersRepository
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
        this.projectLookupService = projectLookupService;
        this.teamRepository = teamRepository;
        this.teamMembersRepository = teamMembersRepository;
        this.telegramClient = new OkHttpTelegramClient(getBotToken());
    }

    @Override
    public LongPollingUpdateConsumer getUpdatesConsumer() {
        return this;
    }

    @Override
    public void consume(Update update) {
        if (!update.hasMessage() || !update.getMessage().hasText()) return;

        String rawText = update.getMessage().getText();
        String messageTextFromTelegram = normalizeIncomingText(rawText);
        long chatId = update.getMessage().getChatId();

        logger.info("=== BOT MESSAGE RECEIVED ===");
        logger.info("ChatId: {}, Raw: '{}', Normalized: '{}'", chatId, rawText, messageTextFromTelegram);
        logger.info("Current State: {}", stateManager.getState(chatId));

        try {
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
            actions.setProjectLookupService(projectLookupService);
            actions.setTeamRepository(teamRepository);
            actions.setTeamMembersRepository(teamMembersRepository);

            if (actions.getTodoService() == null) {
                logger.info("todosvc error");
                actions.setTodoService(toDoItemService);
            }

            actions.fnStart();
            actions.fnSessionLogin();
            actions.fnLogOut();
            actions.fnMyPerformance();
            actions.fnSelectMyPerformanceScope();
            actions.fnListAll();
            actions.fnSelectSprintForNewTask();
            actions.fnSelectAssigneeForNewTask();
            actions.fnSelectSprint();
            actions.fnSelectUserInSprint();
            actions.fnVerifyCredentialsPhoneEmail();
            actions.fnVerifyCredentialsPassword();
            actions.fnViewSprintTasks();
            actions.fnSelectTaskStatus();
            actions.fnDone();
            actions.fnUndo();
            actions.fnDelete();
            actions.fnAddItem();
            actions.fnHide();
            actions.fnLLM();
            actions.fnElse();

            boolean handled = actions.wasHandled();
            logger.info("=== BOT HANDLERS COMPLETE (handled={}) ===", handled);
            if (!handled) {
                logger.warn("No handler matched message '{}' for chatId={}", messageTextFromTelegram, chatId);
                BotHelper.sendMessageToTelegram(
                        chatId,
                        "I did not understand that message. Tap /start or send /start to sign in.",
                        telegramClient,
                        null);
            }
        } catch (Exception e) {
            logger.error("Bot handler error for chatId={}: {}", chatId, e.getMessage(), e);
            BotHelper.sendMessageToTelegram(
                    chatId,
                    "Something went wrong. Please try /start again.",
                    telegramClient,
                    null);
        }
    }

    @AfterBotRegistration
    public void afterRegistration(BotSession botSession) {
        String token = botProps.getToken();
        boolean tokenConfigured = token != null && !token.isBlank();
        logger.info(
                "Telegram long-polling session running: {}, tokenConfigured: {}, botUsername: {}",
                botSession.isRunning(),
                tokenConfigured,
                botProps.getUsername());
        if (!tokenConfigured) {
            logger.error("TELEGRAM_BOT_TOKEN is empty. Set telegram.bot.token or env TELEGRAM_BOT_TOKEN.");
        }
    }

    /** Strips {@code @BotName} from commands (e.g. {@code /start@MyBot} → {@code /start}). */
    private static String normalizeIncomingText(String raw) {
        if (raw == null) {
            return "";
        }
        String trimmed = raw.trim();
        if (!trimmed.startsWith("/")) {
            return trimmed;
        }
        int spaceIdx = trimmed.indexOf(' ');
        String commandPart = spaceIdx >= 0 ? trimmed.substring(0, spaceIdx) : trimmed;
        int atIdx = commandPart.indexOf('@');
        if (atIdx > 0) {
            commandPart = commandPart.substring(0, atIdx);
        }
        return spaceIdx >= 0 ? commandPart + trimmed.substring(spaceIdx) : commandPart;
    }
}
