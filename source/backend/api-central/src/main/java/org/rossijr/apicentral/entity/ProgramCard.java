package org.rossijr.apicentral.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrimaryKeyJoinColumn;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

@Data
@NoArgsConstructor
@Entity
@Table(name = "tb_program_card", schema = "api_central")
public class ProgramCard {

    @Id
    @Column(name = "id_program_card", nullable = false)
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tx_title", nullable = false)
    private String title;

    @Column(name = "dt_shift_start")
    private LocalDateTime shiftStart;

    @Column(name = "dt_shift_end")
    private LocalDateTime shiftEnd;

    @Column(name = "tx_sector")
    private String sector;

    @Column(name = "tx_criminal_focus")
    private String criminalFocus;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @OneToOne
    @PrimaryKeyJoinColumn(name = "id_user_assigned")
    private User userAssigned;

    @OneToOne
    @PrimaryKeyJoinColumn(name = "id_vehicle_assigned")
    private Vehicle vehicleAssigned;

    @OneToMany
    private Set<Activity> activities;
}
