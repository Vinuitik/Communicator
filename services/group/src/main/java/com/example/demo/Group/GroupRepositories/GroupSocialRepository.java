package com.example.demo.Group.GroupRepositories;

import com.example.demo.Group.GroupEntities.GroupSocial;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GroupSocialRepository extends JpaRepository<GroupSocial, Integer> {
}
