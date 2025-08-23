package com.example.demo.Group.GroupEntities;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.validation.constraints.NotNull;
import lombok.ToString;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Setter
@Builder
public class GroupPermission {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Integer id;

    private LocalDate date;

    @Lob
    @JsonProperty("fact")
    @NotNull(message = "Text is required")
    private String text;
    
    @NotNull(message = "Priority is required")
    @JsonProperty("importance")
    private Long priority;

    private LocalDate reviewDate;
    
    private Integer interval;

    @ManyToOne
    @JoinColumn(name = "group_id")
    @JsonBackReference
    @ToString.Exclude
    private SocialGroup group;
}
