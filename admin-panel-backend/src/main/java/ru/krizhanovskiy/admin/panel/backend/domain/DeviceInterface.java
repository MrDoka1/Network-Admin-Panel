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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.DeviceInterfaceAdminStatus;

import java.util.UUID;

@Entity
@Table(
        name = "device_interface",
        uniqueConstraints = @UniqueConstraint(columnNames = {"device_id", "name"})
)
@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class DeviceInterface {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "device_id", nullable = false)
    private NetworkDevice device;

    @Column(nullable = false, length = 128)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "admin_status", nullable = false, length = 16)
    private DeviceInterfaceAdminStatus adminStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_interface_id")
    private DeviceInterface parentInterface;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dot1q_vlan_id")
    private Vlan dot1qVlan;

    @JdbcTypeCode(SqlTypes.INET)
    @Column(name = "ip_address")
    private String ipAddress;

    @OneToOne(mappedBy = "deviceInterface", fetch = FetchType.LAZY)
    private InterfaceVlan interfaceVlan;
}
