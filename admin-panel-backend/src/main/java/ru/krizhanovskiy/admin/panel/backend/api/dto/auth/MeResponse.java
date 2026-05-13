package ru.krizhanovskiy.admin.panel.backend.api.dto.auth;

import java.util.List;

public record MeResponse(
        String login,
        String firstName,
        String lastName,
        List<String> roles) {
}
