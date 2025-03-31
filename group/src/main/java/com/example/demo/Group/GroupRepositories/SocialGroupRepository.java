package com.example.demo.Group.GroupRepositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.demo.Group.GroupEntities.SocialGroup;

@Repository
public interface SocialGroupRepository extends JpaRepository<SocialGroup, Integer> {

}
