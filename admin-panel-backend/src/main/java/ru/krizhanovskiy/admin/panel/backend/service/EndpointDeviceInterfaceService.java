package ru.krizhanovskiy.admin.panel.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointDeviceInterfaceCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointDeviceInterfaceResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointDeviceInterfaceUpdateRequest;
import ru.krizhanovskiy.admin.panel.backend.domain.EndpointDeviceInterface;
import ru.krizhanovskiy.admin.panel.backend.mapper.NetworkEntityMapper;
import ru.krizhanovskiy.admin.panel.backend.repository.EndpointDeviceInterfaceRepository;
import ru.krizhanovskiy.admin.panel.backend.web.error.NotFoundException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EndpointDeviceInterfaceService {

    private final EndpointDeviceInterfaceRepository endpointDeviceInterfaceRepository;
    private final EndpointDeviceService endpointDeviceService;
    private final NetworkEntityMapper networkEntityMapper;

    @Transactional(readOnly = true)
    public List<EndpointDeviceInterfaceResponse> listByEndpointDevice(UUID endpointDeviceId) {
        endpointDeviceService.endpointById(endpointDeviceId);
        return endpointDeviceInterfaceRepository.findByEndpointDevice_Id(endpointDeviceId).stream()
                .map(networkEntityMapper::toEndpointDeviceInterfaceResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public EndpointDeviceInterfaceResponse getById(UUID id) {
        return networkEntityMapper.toEndpointDeviceInterfaceResponse(interfaceById(id));
    }

    @Transactional
    public EndpointDeviceInterfaceResponse create(UUID endpointDeviceId, EndpointDeviceInterfaceCreateRequest request) {
        var device = endpointDeviceService.endpointById(endpointDeviceId);
        EndpointDeviceInterface e = new EndpointDeviceInterface();
        e.setEndpointDevice(device);
        e.setName(request.name());
        e.setMacAddress(request.macAddress());
        e.setAdminStatus(request.adminStatus());
        EndpointDeviceInterface saved = endpointDeviceInterfaceRepository.save(e);
        return networkEntityMapper.toEndpointDeviceInterfaceResponse(
                endpointDeviceInterfaceRepository.findFetchedById(saved.getId())
                        .orElse(saved));
    }

    @Transactional
    public EndpointDeviceInterfaceResponse update(UUID id, EndpointDeviceInterfaceUpdateRequest request) {
        EndpointDeviceInterface e = interfaceById(id);
        e.setName(request.name());
        e.setMacAddress(request.macAddress());
        e.setAdminStatus(request.adminStatus());
        EndpointDeviceInterface saved = endpointDeviceInterfaceRepository.save(e);
        return networkEntityMapper.toEndpointDeviceInterfaceResponse(
                endpointDeviceInterfaceRepository.findFetchedById(saved.getId())
                        .orElse(saved));
    }

    @Transactional
    public void delete(UUID id) {
        if (!endpointDeviceInterfaceRepository.existsById(id)) {
            throw new NotFoundException("Интерфейс оконечного устройства не найден: " + id);
        }
        endpointDeviceInterfaceRepository.deleteById(id);
    }

    EndpointDeviceInterface interfaceById(UUID id) {
        return endpointDeviceInterfaceRepository.findFetchedById(id)
                .orElseThrow(() -> new NotFoundException("Интерфейс оконечного устройства не найден: " + id));
    }
}
