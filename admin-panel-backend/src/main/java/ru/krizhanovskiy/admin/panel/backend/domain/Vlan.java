package ru.krizhanovskiy.admin.panel.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.VlanAdminStatus;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.VlanOperStatus;

@Entity
@Table(name = "vlan")
@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Vlan {

    @Id
    @Column(name = "vlan_id")
    @EqualsAndHashCode.Include
    private Short vlanId;

    @Column(length = 256)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "admin_status", nullable = false, length = 32)
    private VlanAdminStatus adminStatus = VlanAdminStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "oper_status", length = 32)
    private VlanOperStatus operStatus;

    @Column(name = "is_protected", nullable = false)
    private boolean isProtected = false;
}
