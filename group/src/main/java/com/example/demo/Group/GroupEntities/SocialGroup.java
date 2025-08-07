package com.example.demo.Group.GroupEntities;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonManagedReference;

import com.example.demo.Group.GroupEntities.GroupPermission;
import jakarta.persistence.OneToMany;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.Getter;

@Getter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Data
@Builder
public class SocialGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer id;

    private String name;

    private String description;

    @OneToMany(mappedBy = "group", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    @Builder.Default
    private List<GroupKnowledge> knowledge = new ArrayList<>();

    @OneToMany(mappedBy = "group", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    @Builder.Default
    private List<GroupPermission> permissions = new ArrayList<>();

    // Constructor to ensure lists are initialized
    public SocialGroup(String name, String description) {
        this.name = name;
        this.description = description;
        this.knowledge = new ArrayList<>();
        this.permissions = new ArrayList<>();
    }
}
