package ru.krizhanovskiy.admin.panel.backend.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.DeviceType;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.NetworkDeviceStatus;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "network_device")
@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class NetworkDevice {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "device_type", nullable = false, length = 32)
    private DeviceType deviceType;

    @Column(nullable = false)
    private String hostname;

    @Column(name = "mgmt_ip", nullable = false, length = 64)
    private String mgmtIp;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private NetworkDeviceStatus status;

    @OneToMany(mappedBy = "device", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DeviceInterface> interfaces = new ArrayList<>();
}
