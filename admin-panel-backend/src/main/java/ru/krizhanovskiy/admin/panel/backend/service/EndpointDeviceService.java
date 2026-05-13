package ru.krizhanovskiy.admin.panel.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointDeviceCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointDeviceResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.EndpointDeviceUpdateRequest;
import ru.krizhanovskiy.admin.panel.backend.domain.EndpointDevice;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.NetworkDeviceStatus;
import ru.krizhanovskiy.admin.panel.backend.mapper.NetworkEntityMapper;
import ru.krizhanovskiy.admin.panel.backend.repository.EndpointDeviceRepository;
import ru.krizhanovskiy.admin.panel.backend.web.error.NotFoundException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EndpointDeviceService {

    private final EndpointDeviceRepository endpointDeviceRepository;
    private final NetworkEntityMapper networkEntityMapper;

    @Transactional(readOnly = true)
    public List<EndpointDeviceResponse> listAll() {
        return endpointDeviceRepository.findAll().stream()
                .map(networkEntityMapper::toEndpointDeviceResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public EndpointDeviceResponse getById(UUID id) {
        return networkEntityMapper.toEndpointDeviceResponse(endpointById(id));
    }

    @Transactional
    public EndpointDeviceResponse create(EndpointDeviceCreateRequest request) {
        EndpointDevice e = new EndpointDevice();
        e.setHostname(request.hostname());
        e.setStatus(request.status() != null ? request.status() : NetworkDeviceStatus.ACTIVE);
        return networkEntityMapper.toEndpointDeviceResponse(endpointDeviceRepository.save(e));
    }

    @Transactional
    public EndpointDeviceResponse update(UUID id, EndpointDeviceUpdateRequest request) {
        EndpointDevice e = endpointById(id);
        e.setHostname(request.hostname());
        e.setStatus(request.status());
        return networkEntityMapper.toEndpointDeviceResponse(endpointDeviceRepository.save(e));
    }

    @Transactional
    public void delete(UUID id) {
        if (!endpointDeviceRepository.existsById(id)) {
            throw new NotFoundException("Оконечное устройство не найдено: " + id);
        }
        endpointDeviceRepository.deleteById(id);
    }

    EndpointDevice endpointById(UUID id) {
        return endpointDeviceRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Оконечное устройство не найдено: " + id));
    }
}
