package com.communicator.knowledgecore.entities;

import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.MappedSuperclass;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

/**
 * Common shape shared by every "fact about a relationship" entity — friend/group
 * Knowledge, friend/group Permission, and connections' Knowledge/Permission (see
 * CODE_REUSE_REPORT.md §2). Field names are unchanged from the original
 * hand-copied entities so Hibernate's default column naming keeps mapping onto
 * the exact same columns — extending this class is not a schema change.
 *
 * The owning relationship (friend/group/connection) is deliberately NOT here —
 * each domain's FK shape differs (single surrogate id vs. connections' composite
 * friend1Id/friend2Id), so subclasses declare their own @ManyToOne.
 */
@MappedSuperclass
@Getter
@Setter
public abstract class AbstractFact {

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
}
