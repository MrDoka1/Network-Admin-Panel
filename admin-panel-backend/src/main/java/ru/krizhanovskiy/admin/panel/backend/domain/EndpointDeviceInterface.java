package ru.krizhanovskiy.admin.panel.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.DeviceInterfaceAdminStatus;

import java.util.UUID;

@Entity
@Table(
        name = "endpoint_device_interface",
        uniqueConstraints = {
                @UniqueConstraint(columnNames = {"endpoint_device_id", "name"}),
                @UniqueConstraint(columnNames = {"mac_address"})
        }
)
@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class EndpointDeviceInterface {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "endpoint_device_id", nullable = false)
    private EndpointDevice endpointDevice;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(name = "mac_address", nullable = false, length = 32)
    private String macAddress;

    @Enumerated(EnumType.STRING)
    @Column(name = "admin_status", nullable = false, length = 16)
    private DeviceInterfaceAdminStatus adminStatus;

    @OneToOne(mappedBy = "endpointInterface", fetch = FetchType.LAZY)
    private EndpointNetworkAttachment attachment;
}
