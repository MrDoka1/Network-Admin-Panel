package ru.krizhanovskiy.admin.panel.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.LinkCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.LinkResponse;
import ru.krizhanovskiy.admin.panel.backend.domain.Link;
import ru.krizhanovskiy.admin.panel.backend.mapper.NetworkEntityMapper;
import ru.krizhanovskiy.admin.panel.backend.repository.LinkRepository;
import ru.krizhanovskiy.admin.panel.backend.web.error.NotFoundException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LinkService {

    private final LinkRepository linkRepository;
    private final DeviceInterfaceService deviceInterfaceService;
    private final NetworkEntityMapper networkEntityMapper;

    @Transactional(readOnly = true)
    public List<LinkResponse> listAll() {
        return linkRepository.findAll().stream()
                .map(networkEntityMapper::toLinkResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public LinkResponse getById(UUID id) {
        return networkEntityMapper.toLinkResponse(linkById(id));
    }

    @Transactional
    public LinkResponse create(LinkCreateRequest request) {
        if (request.interfaceAId().equals(request.interfaceBId())) {
            throw new IllegalArgumentException("Оба конца линка не могут указывать на один и тот же интерфейс");
        }
        var a = deviceInterfaceService.interfaceById(request.interfaceAId());
        var b = deviceInterfaceService.interfaceById(request.interfaceBId());
        Link e = new Link();
        e.setInterfaceA(a);
        e.setInterfaceB(b);
        return networkEntityMapper.toLinkResponse(linkRepository.save(e));
    }

    @Transactional
    public void delete(UUID id) {
        if (!linkRepository.existsById(id)) {
            throw new NotFoundException("Линк не найден: " + id);
        }
        linkRepository.deleteById(id);
    }

    Link linkById(UUID id) {
        return linkRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Линк не найден: " + id));
    }
}
