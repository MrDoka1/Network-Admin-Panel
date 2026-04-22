package ru.krizhanovskiy.admin.panel.backend.web.controller.network;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.InterfaceVlanResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.InterfaceVlanUpsertRequest;
import ru.krizhanovskiy.admin.panel.backend.service.InterfaceVlanService;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/network/interfaces/{interfaceId}/vlan")
@RequiredArgsConstructor
@Tag(name = "VLAN на интерфейсе", description = "Режим access/trunk для порта")
public class InterfaceVlanController {

    private final InterfaceVlanService interfaceVlanService;

    @GetMapping
    @Operation(summary = "Получить настройки VLAN интерфейса")
    public InterfaceVlanResponse get(@PathVariable UUID interfaceId) {
        return interfaceVlanService.getByInterfaceId(interfaceId);
    }

    @PutMapping
    @Operation(summary = "Создать или обновить настройки VLAN")
    public InterfaceVlanResponse upsert(
            @PathVariable UUID interfaceId,
            @Valid @RequestBody InterfaceVlanUpsertRequest request) {
        return interfaceVlanService.upsert(interfaceId, request);
    }

    @DeleteMapping
    @Operation(summary = "Удалить настройки VLAN с интерфейса")
    public ResponseEntity<Void> delete(@PathVariable UUID interfaceId) {
        interfaceVlanService.deleteByInterfaceId(interfaceId);
        return ResponseEntity.noContent().build();
    }
}
