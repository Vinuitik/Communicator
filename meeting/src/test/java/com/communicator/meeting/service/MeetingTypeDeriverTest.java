package com.communicator.meeting.service;

import org.junit.jupiter.api.Test;

import com.communicator.meeting.entities.MeetingType;

import static org.assertj.core.api.Assertions.assertThat;

class MeetingTypeDeriverTest {

    @Test
    void selfPlusOneOther_isFriend() {
        assertThat(MeetingTypeDeriver.derive(true, 1)).isEqualTo(MeetingType.FRIEND);
    }

    @Test
    void selfPlusTwoOrMoreOthers_isGroup() {
        assertThat(MeetingTypeDeriver.derive(true, 2)).isEqualTo(MeetingType.GROUP);
        assertThat(MeetingTypeDeriver.derive(true, 5)).isEqualTo(MeetingType.GROUP);
    }

    @Test
    void noSelfPlusExactlyTwo_isConnection() {
        assertThat(MeetingTypeDeriver.derive(false, 2)).isEqualTo(MeetingType.CONNECTION);
    }

    @Test
    void noSelfPlusThreeOrMore_isStillGroup() {
        assertThat(MeetingTypeDeriver.derive(false, 3)).isEqualTo(MeetingType.GROUP);
        assertThat(MeetingTypeDeriver.derive(false, 6)).isEqualTo(MeetingType.GROUP);
    }
}
