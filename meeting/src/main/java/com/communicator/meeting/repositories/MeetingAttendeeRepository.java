package com.communicator.meeting.repositories;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.communicator.meeting.entities.MeetingAttendee;

public interface MeetingAttendeeRepository extends JpaRepository<MeetingAttendee, Long> {

    List<MeetingAttendee> findByMeetingId(Long meetingId);
}
