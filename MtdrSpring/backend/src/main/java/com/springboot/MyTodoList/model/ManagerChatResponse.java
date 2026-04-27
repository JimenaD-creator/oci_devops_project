package com.springboot.MyTodoList.model;
public class ManagerChatResponse {

    private String reply;
    private String contextScope; // "sprint_X" | "all_sprints"
    private boolean error;
    private String errorCode;

    public static ManagerChatResponse of(String reply, String contextScope) {
        ManagerChatResponse r = new ManagerChatResponse();
        r.reply = reply;
        r.contextScope = contextScope;
        r.error = false;
        return r;
    }

    public static ManagerChatResponse error(String errorCode, String message) {
        ManagerChatResponse r = new ManagerChatResponse();
        r.reply = message;
        r.errorCode = errorCode;
        r.error = true;
        return r;
    }

    public String getReply() { return reply; }
    public void setReply(String reply) { this.reply = reply; }

    public String getContextScope() { return contextScope; }
    public void setContextScope(String contextScope) { this.contextScope = contextScope; }

    public boolean isError() { return error; }
    public void setError(boolean error) { this.error = error; }

    public String getErrorCode() { return errorCode; }
    public void setErrorCode(String errorCode) { this.errorCode = errorCode; }
}