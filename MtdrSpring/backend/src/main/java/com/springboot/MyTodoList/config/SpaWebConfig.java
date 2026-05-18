package com.springboot.MyTodoList.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Serves the React app for client-side routes (e.g. /login) without touching /api/**.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class SpaWebConfig extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        if (!HttpMethod.GET.matches(request.getMethod()) || shouldNotForward(request.getRequestURI())) {
            filterChain.doFilter(request, response);
            return;
        }
        RequestDispatcher dispatcher = request.getRequestDispatcher("/index.html");
        dispatcher.forward(request, response);
    }

    private static boolean shouldNotForward(String uri) {
        if (uri == null || uri.isEmpty() || "/".equals(uri)) {
            return true;
        }
        return uri.startsWith("/api")
                || uri.startsWith("/swagger")
                || uri.startsWith("/v2/api-docs")
                || uri.startsWith("/v3/api-docs")
                || uri.startsWith("/static")
                || uri.contains(".");
    }
}
