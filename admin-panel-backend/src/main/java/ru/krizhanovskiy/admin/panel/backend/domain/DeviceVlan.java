package ru.krizhanovskiy.admin.panel.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.VlanAdminStatus;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.VlanOperStatus;

@Entity
@Table(name = "device_vlan")
@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class DeviceVlan {

    @EmbeddedId
    @EqualsAndHashCode.Include
    private DeviceVlanId id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("deviceId")
    @JoinColumn(name = "device_id", nullable = false)
    private NetworkDevice device;

    @Column(length = 256)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "admin_status", nullable = false, length = 32)
    private VlanAdminStatus adminStatus = VlanAdminStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "oper_status", length = 32)
    private VlanOperStatus operStatus;
}
