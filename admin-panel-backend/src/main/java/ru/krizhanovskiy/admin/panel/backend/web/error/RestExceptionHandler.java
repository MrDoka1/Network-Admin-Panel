package ru.krizhanovskiy.admin.panel.backend.web.error;

import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestControllerAdvice
public class RestExceptionHandler {

    private static final Pattern PG_DETAIL = Pattern.compile(
            "(?i)(?:Detail|Подробности):\\s*(.+)", Pattern.MULTILINE);
    private static final Pattern DEVICE_IFACE_NAME_KEY =
            Pattern.compile("Key \\(device_id, name\\)=\\([^,]+,\\s*([^)]+)\\)");

    @ExceptionHandler(NotFoundException.class)
    public ProblemDetail handleNotFound(NotFoundException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        pd.setTitle("Not Found");
        return pd;
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ProblemDetail handleBadRequest(IllegalArgumentException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        pd.setTitle("Bad Request");
        return pd;
    }

    @ExceptionHandler(ConflictException.class)
    public ProblemDetail handleConflict(ConflictException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        pd.setTitle("Conflict");
        return pd;
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail handleDataIntegrity(DataIntegrityViolationException ex) {
        String detail = resolveDataIntegrityDetail(ex);
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, detail);
        pd.setTitle("Conflict");
        return pd;
    }

    private static String resolveDataIntegrityDetail(DataIntegrityViolationException ex) {
        String constraintName = findConstraintName(ex);
        if (constraintName != null) {
            String mapped = mapConstraintToMessage(constraintName, ex);
            if (mapped != null) {
                return mapped;
            }
        }
        String pgDetail = extractPgDetail(ex.getMostSpecificCause().getMessage());
        if (pgDetail != null && !pgDetail.isBlank()) {
            return "Операция нарушает ограничения базы данных: " + pgDetail.trim();
        }
        return "Операция нарушает ограничения базы данных (уникальность или ссылки)";
    }

    private static String findConstraintName(DataIntegrityViolationException ex) {
        for (Throwable t = ex; t != null; t = t.getCause()) {
            if (t instanceof ConstraintViolationException cve) {
                return cve.getConstraintName();
            }
        }
        return null;
    }

    private static String mapConstraintToMessage(String constraintName, DataIntegrityViolationException ex) {
        String message = ex.getMostSpecificCause().getMessage();
        return switch (constraintName) {
            case "uq_device_interface_device_name" -> deviceInterfaceDuplicateName(message);
            case "uq_device_interface_parent_dot1q_vlan" ->
                    "На этом физическом порту уже есть сабинтерфейс с таким VLAN 802.1Q.";
            case "uq_link_interface_pair" ->
                    "Связь с такой парой интерфейсов уже существует или один из портов уже занят в другой связи.";
            case "uq_endpoint_device_interface_device_name" ->
                    "На этом конечном устройстве уже есть интерфейс с таким именем.";
            case "uq_endpoint_device_interface_mac" ->
                    "Интерфейс с таким MAC-адресом уже существует.";
            case "uq_endpoint_network_attachment_network_if" ->
                    "Сетевой интерфейс уже привязан к конечному устройству.";
            case "uq_endpoint_network_attachment_endpoint_if" ->
                    "Интерфейс конечного устройства уже привязан к сети.";
            case "uq_users_login" -> "Пользователь с таким логином уже существует.";
            case "uq_roles_name" -> "Роль с таким именем уже существует.";
            default -> null;
        };
    }

    private static String deviceInterfaceDuplicateName(String rawMessage) {
        if (rawMessage == null) {
            return "На этом устройстве уже есть интерфейс с таким именем.";
        }
        Matcher m = DEVICE_IFACE_NAME_KEY.matcher(rawMessage);
        if (m.find()) {
            return "На этом устройстве уже есть интерфейс с именем «" + m.group(1).trim() + "».";
        }
        return "На этом устройстве уже есть интерфейс с таким именем.";
    }

    private static String extractPgDetail(String message) {
        if (message == null) {
            return null;
        }
        Matcher m = PG_DETAIL.matcher(message);
        return m.find() ? m.group(1) : null;
    }
}
