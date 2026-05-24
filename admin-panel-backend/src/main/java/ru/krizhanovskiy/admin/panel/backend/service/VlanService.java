package ru.krizhanovskiy.admin.panel.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.VlanCreateRequest;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.VlanResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.network.VlanUpdateRequest;
import ru.krizhanovskiy.admin.panel.backend.domain.Vlan;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.VlanAdminStatus;
import ru.krizhanovskiy.admin.panel.backend.mapper.NetworkEntityMapper;
import ru.krizhanovskiy.admin.panel.backend.repository.VlanRepository;
import ru.krizhanovskiy.admin.panel.backend.web.error.NotFoundException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class VlanService {

    private final VlanRepository vlanRepository;
    private final NetworkEntityMapper networkEntityMapper;

    @Transactional(readOnly = true)
    public List<VlanResponse> listAll() {
        return vlanRepository.findAll().stream()
                .map(networkEntityMapper::toVlanResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public VlanResponse getById(Short vlanId) {
        return networkEntityMapper.toVlanResponse(vlanById(vlanId));
    }

    @Transactional
    public VlanResponse create(VlanCreateRequest request) {
        if (vlanRepository.existsById(request.vlanId())) {
            throw new IllegalArgumentException("VLAN с id " + request.vlanId() + " уже существует");
        }
        Vlan e = new Vlan();
        e.setVlanId(request.vlanId());
        e.setName(request.name());
        e.setAdminStatus(request.adminStatus() != null ? request.adminStatus() : VlanAdminStatus.ACTIVE);
        e.setOperStatus(request.operStatus());
        e.setProtected(Boolean.TRUE.equals(request.isProtected()));
        return networkEntityMapper.toVlanResponse(vlanRepository.save(e));
    }

    @Transactional
    public VlanResponse update(Short vlanId, VlanUpdateRequest request) {
        Vlan e = vlanById(vlanId);
        if (request.name() != null) {
            e.setName(request.name());
        }
        if (request.adminStatus() != null) {
            e.setAdminStatus(request.adminStatus());
        }
        if (request.operStatus() != null) {
            e.setOperStatus(request.operStatus());
        }
        if (request.isProtected() != null) {
            e.setProtected(request.isProtected());
        }
        return networkEntityMapper.toVlanResponse(vlanRepository.save(e));
    }

    @Transactional
    public void delete(Short vlanId) {
        if (!vlanRepository.existsById(vlanId)) {
            throw new NotFoundException("VLAN не найден: " + vlanId);
        }
        vlanRepository.deleteById(vlanId);
    }

    Vlan vlanById(Short vlanId) {
        return vlanRepository.findById(vlanId)
                .orElseThrow(() -> new NotFoundException("VLAN не найден: " + vlanId));
    }
}
