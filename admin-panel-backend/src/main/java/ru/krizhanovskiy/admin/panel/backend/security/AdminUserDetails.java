package ru.krizhanovskiy.admin.panel.backend.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import ru.krizhanovskiy.admin.panel.backend.domain.User;

import java.util.Collection;
import java.util.UUID;
import java.util.stream.Collectors;

public record AdminUserDetails(
        UUID id,
        String login,
        String passwordHash,
        String firstName,
        String lastName,
        Collection<? extends GrantedAuthority> authorities) implements UserDetails {

    public static AdminUserDetails from(User user) {
        var authorities = user.getRoles().stream()
                .map(r -> new SimpleGrantedAuthority("ROLE_" + r.getName()))
                .collect(Collectors.toSet());
        return new AdminUserDetails(
                user.getId(),
                user.getLogin(),
                user.getPasswordHash(),
                user.getFirstName(),
                user.getLastName(),
                authorities);
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return login;
    }
}
