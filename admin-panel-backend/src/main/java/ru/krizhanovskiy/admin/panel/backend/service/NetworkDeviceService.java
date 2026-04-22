package ru.krizhanovskiy.admin.panel.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.NetworkDeviceCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.NetworkDeviceResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.NetworkDeviceUpdateRequest;
import ru.krizhanovskiy.admin.panel.backend.domain.NetworkDevice;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.NetworkDeviceStatus;
import ru.krizhanovskiy.admin.panel.backend.mapper.NetworkEntityMapper;
import ru.krizhanovskiy.admin.panel.backend.repository.NetworkDeviceRepository;
import ru.krizhanovskiy.admin.panel.backend.web.error.NotFoundException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NetworkDeviceService {

    private final NetworkDeviceRepository networkDeviceRepository;
    private final NetworkEntityMapper networkEntityMapper;

    @Transactional(readOnly = true)
    public List<NetworkDeviceResponse> listAll() {
        return networkDeviceRepository.findAll().stream()
                .map(networkEntityMapper::toNetworkDeviceResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public NetworkDeviceResponse getById(UUID id) {
        return networkEntityMapper.toNetworkDeviceResponse(deviceById(id));
    }

    @Transactional
    public NetworkDeviceResponse create(NetworkDeviceCreateRequest request) {
        NetworkDevice e = new NetworkDevice();
        e.setDeviceType(request.deviceType());
        e.setHostname(request.hostname());
        e.setMgmtIp(request.mgmtIp());
        e.setStatus(request.status() != null ? request.status() : NetworkDeviceStatus.ACTIVE);
        return networkEntityMapper.toNetworkDeviceResponse(networkDeviceRepository.save(e));
    }

    @Transactional
    public NetworkDeviceResponse update(UUID id, NetworkDeviceUpdateRequest request) {
        NetworkDevice e = deviceById(id);
        e.setDeviceType(request.deviceType());
        e.setHostname(request.hostname());
        e.setMgmtIp(request.mgmtIp());
        e.setStatus(request.status());
        return networkEntityMapper.toNetworkDeviceResponse(networkDeviceRepository.save(e));
    }

    @Transactional
    public void delete(UUID id) {
        if (!networkDeviceRepository.existsById(id)) {
            throw new NotFoundException("Устройство не найдено: " + id);
        }
        networkDeviceRepository.deleteById(id);
    }

    NetworkDevice deviceById(UUID id) {
        return networkDeviceRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Устройство не найдено: " + id));
    }
}
