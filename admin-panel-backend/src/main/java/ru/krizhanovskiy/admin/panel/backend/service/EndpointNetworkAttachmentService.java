package ru.krizhanovskiy.admin.panel.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointNetworkAttachmentCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointNetworkAttachmentResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointNetworkAttachmentUpdateRequest;
import ru.krizhanovskiy.admin.panel.backend.domain.EndpointNetworkAttachment;
import ru.krizhanovskiy.admin.panel.backend.mapper.NetworkEntityMapper;
import ru.krizhanovskiy.admin.panel.backend.repository.EndpointDeviceInterfaceRepository;
import ru.krizhanovskiy.admin.panel.backend.repository.EndpointNetworkAttachmentRepository;
import ru.krizhanovskiy.admin.panel.backend.web.error.NotFoundException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EndpointNetworkAttachmentService {

    private final EndpointNetworkAttachmentRepository endpointNetworkAttachmentRepository;
    private final EndpointDeviceInterfaceRepository endpointDeviceInterfaceRepository;
    private final DeviceInterfaceService deviceInterfaceService;
    private final NetworkEntityMapper networkEntityMapper;

    @Transactional(readOnly = true)
    public List<EndpointNetworkAttachmentResponse> listAll() {
        return endpointNetworkAttachmentRepository.findAllFetched().stream()
                .map(networkEntityMapper::toEndpointNetworkAttachmentResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public EndpointNetworkAttachmentResponse getById(UUID id) {
        return networkEntityMapper.toEndpointNetworkAttachmentResponse(attachmentById(id));
    }

    @Transactional
    public EndpointNetworkAttachmentResponse create(EndpointNetworkAttachmentCreateRequest request) {
        var netIf = deviceInterfaceService.interfaceById(request.networkInterfaceId());
        var endIf = endpointDeviceInterfaceRepository.findById(request.endpointInterfaceId())
                .orElseThrow(() -> new NotFoundException(
                        "Интерфейс оконечного устройства не найден: " + request.endpointInterfaceId()));
        EndpointNetworkAttachment e = new EndpointNetworkAttachment();
        e.setNetworkInterface(netIf);
        e.setEndpointInterface(endIf);
        EndpointNetworkAttachment saved = endpointNetworkAttachmentRepository.save(e);
        return networkEntityMapper.toEndpointNetworkAttachmentResponse(
                endpointNetworkAttachmentRepository.findFetchedById(saved.getId())
                        .orElse(saved));
    }

    @Transactional
    public EndpointNetworkAttachmentResponse update(UUID id, EndpointNetworkAttachmentUpdateRequest request) {
        EndpointNetworkAttachment e = attachmentById(id);
        var netIf = deviceInterfaceService.interfaceById(request.networkInterfaceId());
        var endIf = endpointDeviceInterfaceRepository.findById(request.endpointInterfaceId())
                .orElseThrow(() -> new NotFoundException(
                        "Интерфейс оконечного устройства не найден: " + request.endpointInterfaceId()));
        e.setNetworkInterface(netIf);
        e.setEndpointInterface(endIf);
        EndpointNetworkAttachment saved = endpointNetworkAttachmentRepository.save(e);
        return networkEntityMapper.toEndpointNetworkAttachmentResponse(
                endpointNetworkAttachmentRepository.findFetchedById(saved.getId())
                        .orElse(saved));
    }

    @Transactional
    public void delete(UUID id) {
        if (!endpointNetworkAttachmentRepository.existsById(id)) {
            throw new NotFoundException("Подключение оконечного устройства не найдено: " + id);
        }
        endpointNetworkAttachmentRepository.deleteById(id);
    }

    EndpointNetworkAttachment attachmentById(UUID id) {
        return endpointNetworkAttachmentRepository.findFetchedById(id)
                .orElseThrow(() -> new NotFoundException("Подключение оконечного устройства не найдено: " + id));
    }
}
