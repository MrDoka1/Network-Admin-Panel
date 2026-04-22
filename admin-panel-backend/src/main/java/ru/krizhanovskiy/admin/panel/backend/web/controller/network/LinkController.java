package ru.krizhanovskiy.admin.panel.backend.web.controller.network;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.LinkCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.LinkResponse;
import ru.krizhanovskiy.admin.panel.backend.service.LinkService;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/network/links")
@RequiredArgsConstructor
@Tag(name = "Линки", description = "Связи между двумя интерфейсами")
public class LinkController {

    private final LinkService linkService;

    @GetMapping
    @Operation(summary = "Список линков")
    public List<LinkResponse> list() {
        return linkService.listAll();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Линк по id")
    public LinkResponse get(@PathVariable UUID id) {
        return linkService.getById(id);
    }

    @PostMapping
    @Operation(summary = "Создать линк")
    public ResponseEntity<LinkResponse> create(@Valid @RequestBody LinkCreateRequest request) {
        LinkResponse created = linkService.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Удалить линк")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        linkService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
