package com.communicator.knowledgecore.service;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

import com.communicator.knowledgecore.entities.AbstractFact;

import jakarta.persistence.EntityNotFoundException;

/**
 * Shared CRUD for every AbstractFact subclass (friend/group/connections Knowledge
 * and Permission). Owner-scoped finders (findByFriendId, findByGroupId, ...) stay
 * in each concrete repository/service — Spring Data derived-query method names
 * can't be genuinely generalized across differently-shaped owner relationships,
 * so this only extracts what's truly identical: the swallow-and-print-free CRUD
 * primitives and the priority-DESC pagination default (CODE_REUSE_REPORT.md §2/§7).
 */
public abstract class AbstractFactService<T extends AbstractFact, ID> {

    protected abstract JpaRepository<T, ID> repository();

    public T getById(ID id) {
        return repository().findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Not found: " + id));
    }

    public Optional<T> findById(ID id) {
        return repository().findById(id);
    }

    public T save(T item) {
        return repository().save(item);
    }

    public List<T> saveAll(List<T> items) {
        return repository().saveAll(items);
    }

    public boolean deleteById(ID id) {
        if (!repository().existsById(id)) {
            return false;
        }
        repository().deleteById(id);
        return true;
    }

    /**
     * Fetch-and-merge update: only text/priority are user-editable via this path
     * (date/reviewDate/interval belong to the review-scheduling flow, not the edit
     * form). Standardizes on the safer of the two pre-existing behaviors — group's
     * fetch-and-merge, not friend's old blind whole-row overwrite.
     */
    public T update(ID id, T changes) {
        T existing = getById(id);
        existing.setText(changes.getText());
        existing.setPriority(changes.getPriority());
        return repository().save(existing);
    }

    protected Pageable priorityPage(int page, int size) {
        return PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "priority"));
    }
}
