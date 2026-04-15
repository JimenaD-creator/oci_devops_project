package com.springboot.MyTodoList.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Maps Telegram chat IDs to database user IDs.
 * This allows the bot to know which database user corresponds to each Telegram chat.
 * 
 * Currently uses in-memory storage. In production, consider persisting to database.
 * 
 * Usage flow:
 * 1. User starts bot, we register the mapping
 * 2. When processing messages, we look up the userId for that chatId
 * 3. Use userId for database operations (UserTask, etc.)
 */
@Service
public class TelegramUserMappingService {
    
    private static final Logger logger = LoggerFactory.getLogger(TelegramUserMappingService.class);
    
    // Map: Telegram chatId → Database userId
    private final Map<Long, Integer> chatIdToUserIdMap = new ConcurrentHashMap<>();
    
    /**
     * Register a mapping between Telegram chat and database user
     * Call this when user starts the bot
     * 
     * @param chatId Telegram chat ID
     * @param userId Database user ID
     */
    public void registerUser(Long chatId, Integer userId) {
        chatIdToUserIdMap.put(chatId, userId);
        logger.info("Registered mapping: chatId {} → userId {}", chatId, userId);
    }
    
    /**
     * Get the database user ID for a Telegram chat
     * 
     * @param chatId Telegram chat ID
     * @return Database user ID, or null if not registered
     */
    public Integer getUserIdByChatId(Long chatId) {
        Integer userId = chatIdToUserIdMap.get(chatId);
        
        if (userId == null) {
            logger.warn("No user mapping found for chatId {}", chatId);
            // For now, default to user 1 (TODO: handle proper user onboarding)
            return 1;
        }
        
        return userId;
    }
    
    /**
     * Check if a user is registered
     * 
     * @param chatId Telegram chat ID
     * @return true if registered
     */
    public boolean isUserRegistered(Long chatId) {
        return chatIdToUserIdMap.containsKey(chatId);
    }
    
    /**
     * Remove a user mapping (when user unsubscribes, etc.)
     * 
     * @param chatId Telegram chat ID
     */
    public void unregisterUser(Long chatId) {
        chatIdToUserIdMap.remove(chatId);
        logger.info("Unregistered mapping for chatId {}", chatId);
    }
    
    /**
     * Get all registered mappings (for monitoring/debugging)
     * 
     * @return Map of all mappings
     */
    public Map<Long, Integer> getAllMappings() {
        return new ConcurrentHashMap<>(chatIdToUserIdMap);
    }
}
