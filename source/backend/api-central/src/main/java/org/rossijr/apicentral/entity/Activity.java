package org.rossijr.apicentral.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@Entity
@Table(name = "tb_activity", schema = "api_central")
public class Activity {

    @Id
    @Column(name = "id_activity", nullable = false)
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tx_place")
    private String place;

    @Column(name = "dt_time")
    private LocalDateTime time;

    @Column(name = "tx_activity")
    private String activity;

    @Column(name = "tx_notes")
    private String notes;

    @ManyToOne
    @JoinColumn(name = "id_program_card")
    private ProgramCard programCard;

}
