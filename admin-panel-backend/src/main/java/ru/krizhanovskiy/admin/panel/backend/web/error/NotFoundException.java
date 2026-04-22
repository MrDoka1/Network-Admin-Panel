package ru.krizhanovskiy.admin.panel.backend.web.error;

public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }
}
