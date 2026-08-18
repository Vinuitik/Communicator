package com.communicator.meeting.repositories;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;

import com.communicator.meeting.entities.Meeting;
import com.communicator.meeting.entities.MeetingSource;
import com.communicator.meeting.entities.MeetingStatus;

public interface MeetingRepository extends JpaRepository<Meeting, Long> {

    /** The friend's single open (not DONE/CANCELLED) FSRS_PROPOSED row, if any — upsert target. */
    Optional<Meeting> findByFriendIdAndSourceAndStatus(
        Integer friendId, MeetingSource source, MeetingStatus status);

    Optional<Meeting> findByFriendIdAndSource(Integer friendId, MeetingSource source);

    List<Meeting> findByFriendIdAndSourceAndStatusNot(
        Integer friendId, MeetingSource source, MeetingStatus excludedStatus);

    List<Meeting> findByDateBetweenAndStatusNot(
        @Param("start") LocalDate start, @Param("end") LocalDate end, MeetingStatus excludedStatus);

    List<Meeting> findByFriendIdAndStatusNot(Integer friendId, MeetingStatus excludedStatus);
}
