package com.springboot.MyTodoList.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.objects.replykeyboard.ReplyKeyboardRemove;
import org.telegram.telegrambots.meta.generics.TelegramClient;
import org.telegram.telegrambots.meta.api.objects.replykeyboard.ReplyKeyboardMarkup;

public class BotHelper {

	private static final Logger logger = LoggerFactory.getLogger(BotHelper.class);

	public static void sendMessageToTelegram(Long chatId, String text, TelegramClient bot) {

		try {
			// prepare message
			SendMessage messageToTelegram = 
					SendMessage
					.builder()
					.chatId(chatId)
					.text(text)
					.replyMarkup(new ReplyKeyboardRemove(true))
					.build()
				;

			// send message
			bot.execute(messageToTelegram);

		} catch (Exception e) {
			logger.error(e.getLocalizedMessage(), e);
		}
	}

	/** Plain text; does not remove or replace the current reply keyboard. */
	public static void sendMessageKeepReplyKeyboard(Long chatId, String text, TelegramClient bot) {
		try {
			SendMessage messageToTelegram =
					SendMessage.builder().chatId(chatId).text(text).build();
			bot.execute(messageToTelegram);
		} catch (Exception e) {
			logger.error(e.getLocalizedMessage(), e);
		}
	}

	public static void sendMessageToTelegram(Long chatId, String text,TelegramClient bot, ReplyKeyboardMarkup rk ) {

		try {
			if (rk == null) {
				sendMessageToTelegram(chatId, text, bot);
				return;
			}
			// prepare message
			SendMessage messageToTelegram = 
					SendMessage
					.builder()
					.chatId(chatId)
					.text(text)
					.replyMarkup(rk)
					.build()
				;

			// send message
			bot.execute(messageToTelegram);

		} catch (Exception e) {
			logger.error(e.getLocalizedMessage(), e);
		}
	}

}
