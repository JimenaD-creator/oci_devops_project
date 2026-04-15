package com.springboot.MyTodoList.util;

import com.springboot.MyTodoList.model.ToDoItem;
import com.springboot.MyTodoList.service.DeepSeekService;
import com.springboot.MyTodoList.service.ToDoItemService;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.telegram.telegrambots.meta.api.objects.replykeyboard.ReplyKeyboardMarkup;
import org.telegram.telegrambots.meta.api.objects.replykeyboard.buttons.KeyboardRow;
import org.telegram.telegrambots.meta.generics.TelegramClient;

public class BotActions {

    private static final Logger logger = LoggerFactory.getLogger(BotActions.class);

    private String requestText;
    private long chatId;
    private TelegramClient telegramClient;
    private boolean exit;

    private ToDoItemService todoService;
    private DeepSeekService deepSeekService;

    public BotActions(TelegramClient tc, ToDoItemService ts, DeepSeekService ds) {
        this.telegramClient = tc;
        this.todoService = ts;
        this.deepSeekService = ds;
        this.exit = false;
    }

    // --- Setters y Getters para compatibilidad con ToDoItemBotController ---
    public void setRequestText(String cmd) { this.requestText = cmd; }
    public void setChatId(long chId) { this.chatId = chId; }
    public void setTelegramClient(TelegramClient tc) { this.telegramClient = tc; }
    public void setTodoService(ToDoItemService tsvc) { this.todoService = tsvc; }
    public void setDeepSeekService(DeepSeekService dssvc) { this.deepSeekService = dssvc; }
    
    public ToDoItemService getTodoService() { return todoService; }
    public DeepSeekService getDeepSeekService() { return deepSeekService; }

    // --- Lógica de Comandos ---

    public void fnStart() {
        if (!(requestText.equals(BotCommands.START_COMMAND.getCommand()) 
            || requestText.equals(BotLabels.SHOW_MAIN_SCREEN.getLabel())) || exit) 
            return;

        BotHelper.sendMessageToTelegram(chatId, BotMessages.HELLO_MYTODO_BOT.getMessage(), telegramClient, ReplyKeyboardMarkup
            .builder()
            .keyboardRow(new KeyboardRow(BotLabels.LIST_ALL_ITEMS.getLabel()))
            .keyboardRow(new KeyboardRow(BotLabels.SHOW_MAIN_SCREEN.getLabel(), BotLabels.HIDE_MAIN_SCREEN.getLabel()))
            .resizeKeyboard(true)
            .build()
        );
        exit = true;
    }

    public void fnListAll() {
        if (!(requestText.equals(BotCommands.TODO_LIST.getCommand())
                || requestText.equals(BotLabels.LIST_ALL_ITEMS.getLabel())
                || requestText.equals(BotLabels.MY_TODO_LIST.getLabel())) || exit)
            return;

        List<ToDoItem> allItems = todoService.findAll();
        List<KeyboardRow> keyboard = new ArrayList<>();

        // Botón superior de navegación
        keyboard.add(new KeyboardRow(BotLabels.SHOW_MAIN_SCREEN.getLabel()));

        // Tareas Pendientes (Filtrado y validación anti-null)
        List<ToDoItem> activeItems = allItems.stream()
                .filter(item -> !item.isDone())
                .collect(Collectors.toList());

        for (ToDoItem item : activeItems) {
            KeyboardRow currentRow = new KeyboardRow();
            // Solución al NullPointerException: Validamos la descripción
            String desc = (item.getDescription() != null && !item.getDescription().isEmpty()) 
                          ? item.getDescription() : "Tarea #" + item.getID();
            
            currentRow.add(desc);
            currentRow.add(item.getID() + BotLabels.DASH.getLabel() + BotLabels.DONE.getLabel());
            keyboard.add(currentRow);
        }

        // Tareas Completadas
        List<ToDoItem> doneItems = allItems.stream()
                .filter(ToDoItem::isDone)
                .collect(Collectors.toList());

        for (ToDoItem item : doneItems) {
            KeyboardRow currentRow = new KeyboardRow();
            String desc = (item.getDescription() != null && !item.getDescription().isEmpty()) 
                          ? item.getDescription() : "Tarea #" + item.getID();
            
            currentRow.add(desc);
            currentRow.add(item.getID() + BotLabels.DASH.getLabel() + BotLabels.UNDO.getLabel());
            currentRow.add(item.getID() + BotLabels.DASH.getLabel() + BotLabels.DELETE.getLabel());
            keyboard.add(currentRow);
        }

        ReplyKeyboardMarkup keyboardMarkup = ReplyKeyboardMarkup.builder()
            .keyboard(keyboard)
            .resizeKeyboard(true) // Lista desplegable
            .selective(true)
            .build();

        BotHelper.sendMessageToTelegram(chatId, "📋 *Tu lista de tareas actual:*", telegramClient, keyboardMarkup);
        exit = true;
    }

    public void fnDone() {
        if (requestText.indexOf(BotLabels.DONE.getLabel()) == -1 || exit) return;
        try {
            String idStr = requestText.substring(0, requestText.indexOf(BotLabels.DASH.getLabel()));
            int id = Integer.parseInt(idStr);
            ToDoItem item = todoService.getToDoItemById(id);
            if (item != null) {
                item.setDone(true);
                todoService.updateToDoItem(id, item);
                BotHelper.sendMessageToTelegram(chatId, BotMessages.ITEM_DONE.getMessage(), telegramClient);
                fnListAll(); // Actualiza la lista automáticamente
            }
        } catch (Exception e) {
            logger.error("Error en fnDone: " + e.getMessage());
        }
        exit = true;
    }

    public void fnUndo() {
        if (requestText.indexOf(BotLabels.UNDO.getLabel()) == -1 || exit) return;
        try {
            String idStr = requestText.substring(0, requestText.indexOf(BotLabels.DASH.getLabel()));
            int id = Integer.parseInt(idStr);
            ToDoItem item = todoService.getToDoItemById(id);
            if (item != null) {
                item.setDone(false);
                todoService.updateToDoItem(id, item);
                BotHelper.sendMessageToTelegram(chatId, BotMessages.ITEM_UNDONE.getMessage(), telegramClient);
                fnListAll();
            }
        } catch (Exception e) {
            logger.error("Error en fnUndo: " + e.getMessage());
        }
        exit = true;
    }

    public void fnDelete() {
        if (requestText.indexOf(BotLabels.DELETE.getLabel()) == -1 || exit) return;
        try {
            String idStr = requestText.substring(0, requestText.indexOf(BotLabels.DASH.getLabel()));
            int id = Integer.parseInt(idStr);
            todoService.deleteToDoItem(id);
            BotHelper.sendMessageToTelegram(chatId, BotMessages.ITEM_DELETED.getMessage(), telegramClient);
            fnListAll();
        } catch (Exception e) {
            logger.error("Error en fnDelete: " + e.getMessage());
        }
        exit = true;
    }

    public void fnHide() {
        if (!(requestText.equals(BotCommands.HIDE_COMMAND.getCommand()) 
            || requestText.equals(BotLabels.HIDE_MAIN_SCREEN.getLabel())) || exit) 
            return;
        BotHelper.sendMessageToTelegram(chatId, BotMessages.BYE.getMessage(), telegramClient);
        exit = true;
    }

    public void fnAddItem() {
        // Bloqueo de creación
        if (!(requestText.contains(BotCommands.ADD_ITEM.getCommand()) 
            || requestText.contains(BotLabels.ADD_NEW_ITEM.getLabel())) || exit)
            return;
        
        BotHelper.sendMessageToTelegram(chatId, "🚫 Solo puedes crear tareas desde la interfaz web.", telegramClient);
        exit = true;
    }

    public void fnLLM() {
        if (!requestText.contains(BotCommands.LLM_REQ.getCommand()) || exit) return;
        try {
            String out = deepSeekService.generateText(requestText.replace(BotCommands.LLM_REQ.getCommand(), ""));
            BotHelper.sendMessageToTelegram(chatId, "🤖 AI: " + out, telegramClient);
        } catch (Exception e) {
            logger.error("Error LLM: " + e.getMessage());
        }
        exit = true;
    }

    public void fnElse() {
        if (exit) return;
        BotHelper.sendMessageToTelegram(chatId, "Comando no reconocido. Usa /todolist para ver tus tareas.", telegramClient);
    }
}