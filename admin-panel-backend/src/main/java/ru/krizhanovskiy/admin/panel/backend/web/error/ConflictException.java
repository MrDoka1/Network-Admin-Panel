package ru.krizhanovskiy.admin.panel.backend.web.error;

public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
