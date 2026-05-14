package ru.krizhanovskiy.admin.panel.backend.service;

import lombok.AllArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import ru.krizhanovskiy.admin.panel.backend.domain.User;
import ru.krizhanovskiy.admin.panel.backend.repository.UserRepository;
import ru.krizhanovskiy.admin.panel.backend.security.AdminUserDetails;
import ru.krizhanovskiy.admin.panel.backend.web.error.NotFoundException;

@Service
@AllArgsConstructor
public class UserAuthService {
    private final UserRepository userRepository;

    public User getCurrentUser() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()) {
            throw new RuntimeException("Пользователь не аутентифицирован");
        }

        Object principal = authentication.getPrincipal();

        if (!(principal instanceof AdminUserDetails details)) {
            throw new RuntimeException("Principal не является AdminUserDetails");
        }

        return userRepository.findById(details.id())
                .orElseThrow(() -> new NotFoundException("Пользователь не найден: " + details.id()));
    }
}