package com.example.demo.Group.GroupEntities;

import com.fasterxml.jackson.annotation.JsonBackReference;

import com.communicator.knowledgecore.entities.AbstractFact;

import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Getter
@Setter
@NoArgsConstructor
@Entity
public class GroupKnowledge extends AbstractFact {

    @ManyToOne
    @JoinColumn(name = "group_id")
    @JsonBackReference
    @ToString.Exclude
    private SocialGroup group;
}
