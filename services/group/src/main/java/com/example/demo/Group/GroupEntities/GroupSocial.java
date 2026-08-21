package com.example.demo.Group.GroupEntities;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Data
@Builder
public class GroupSocial {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer id;

    private String URL;
    private String platform; // e.g., "Instagram", "Twitter", "LinkedIn", "Phone", "Email"
    private String displayName; // e.g., "@username" or "display name"

    @ManyToOne
    @JoinColumn(name = "group_id")
    @JsonBackReference
    @ToString.Exclude
    private SocialGroup socialGroup;
}
