package com.example.demo.Group.GroupEntities;

import com.fasterxml.jackson.annotation.JsonBackReference;

import com.example.demo.Group.GroupEntities.SocialGroup;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import lombok.ToString;
import lombok.Builder;

import lombok.AllArgsConstructor;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.Getter;

@Getter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Setter
@Builder
public class GroupPermission{

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    Integer id;

    @Lob
    String description;

    @ManyToOne
    @JoinColumn(name = "group_id")
    @JsonBackReference
    @ToString.Exclude
    private SocialGroup group;
}
