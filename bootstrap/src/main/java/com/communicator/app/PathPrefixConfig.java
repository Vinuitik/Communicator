package com.communicator.app;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Per-module URL namespaces for the monolith.
 *
 * As separate services, friend/group/connections each owned the root path
 * namespace (nginx stripped their /api/&lt;module&gt;/ prefix before forwarding),
 * so many controllers map identical paths like PUT /updateKnowledge. Merged into
 * one dispatcher those become ambiguous mappings and the app won't start.
 *
 * This prefixes every controller by owning module so their paths never collide,
 * and — because the prefixes equal the existing nginx locations — the frontend's
 * /api/friend/**, /api/groups/**, /api/connections/** URLs keep working (nginx now
 * forwards the prefix instead of stripping it; see nginx.conf).
 *
 * chrono (/chrono) and backup (/backup) already carry their own class-level
 * prefixes and are intentionally left unprefixed here.
 */
@Configuration
public class PathPrefixConfig implements WebMvcConfigurer {

    @Override
    public void configurePathMatch(PathMatchConfigurer configurer) {
        // friend lives under `communicate.*`; backup is the `communicate.backup.*`
        // sub-package and must NOT get the friend prefix (it keeps /backup).
        configurer.addPathPrefix("/api/friend", c ->
                c.getPackageName().startsWith("communicate")
                        && !c.getPackageName().startsWith("communicate.backup"));

        configurer.addPathPrefix("/api/groups", c ->
                c.getPackageName().startsWith("com.example.demo"));

        configurer.addPathPrefix("/api/connections", c ->
                c.getPackageName().startsWith("coommunicator.connections"));

        // meeting's own controller mapping is already "/meetings" (MeetingController),
        // so only "/api" is prepended here — final path is /api/meetings/**, matching
        // the nginx location added alongside this and the frontend's API_BASE.MEETING.
        configurer.addPathPrefix("/api", c ->
                c.getPackageName().startsWith("com.communicator.meeting"));
    }
}
