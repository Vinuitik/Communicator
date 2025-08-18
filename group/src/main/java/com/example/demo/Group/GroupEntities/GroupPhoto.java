package com.example.demo.Group.GroupEntities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupPhoto {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String fileName;
    private String mimeType;
    private LocalDateTime timeBuilt;

    @ManyToOne
    @JoinColumn(name = "group_id")
    private SocialGroup socialGroup;
}
