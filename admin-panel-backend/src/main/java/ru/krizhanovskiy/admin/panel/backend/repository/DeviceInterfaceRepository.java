package ru.krizhanovskiy.admin.panel.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.krizhanovskiy.admin.panel.backend.domain.DeviceInterface;

import java.util.List;
import java.util.UUID;

public interface DeviceInterfaceRepository extends JpaRepository<DeviceInterface, UUID> {

    boolean existsByDevice_IdAndName(UUID deviceId, String name);

    boolean existsByDevice_IdAndNameAndIdNot(UUID deviceId, String name, UUID id);

    boolean existsByParentInterface_IdAndDot1qVlan_VlanId(UUID parentInterfaceId, Short dot1qVlanId);

    boolean existsByParentInterface_IdAndDot1qVlan_VlanIdAndIdNot(
            UUID parentInterfaceId, Short dot1qVlanId, UUID id);

    @Query("""
            SELECT DISTINCT i FROM DeviceInterface i
            LEFT JOIN FETCH i.parentInterface
            LEFT JOIN FETCH i.dot1qVlan
            WHERE i.device.id = :deviceId
            """)
    List<DeviceInterface> findByDevice_Id(@Param("deviceId") UUID deviceId);
}
