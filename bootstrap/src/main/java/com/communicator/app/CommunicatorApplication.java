package com.communicator.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Single entrypoint for the Communicator JVM monolith.
 *
 * Business modules live in their own Maven modules under their original base
 * packages; this class component-scans / entity-scans / repository-scans across
 * all of them. As each module is folded in, add its base package to the three
 * lists below.
 *
 * To add a module: add the Maven dependency in bootstrap/pom.xml, then add its
 * base package to scanBasePackages (+ @EntityScan / @EnableJpaRepositories if it
 * has JPA entities/repositories).
 *
 * Note: friend's base package is `communicate` (WebController sits there);
 * backup's `communicate.backup` is a sub-package of it and is therefore already
 * covered by scanning `communicate`.
 */
@SpringBootApplication(scanBasePackages = {
        "com.communicator.app",
        "communicate",                  // friend + backup (backup is communicate.backup)
        "com.example.demo",             // group (+ app-wide SecurityFilterChain in .config)
        "coommunicator.connections",    // connections (sic: original package typo)
        "com.communicator.chrono",      // chrono (scheduled jobs; no JPA entities)
})
@EntityScan(basePackages = {
        "communicate",                  // friend + backup
        "com.example.demo",             // group
        "coommunicator.connections",    // connections
})
@EnableJpaRepositories(basePackages = {
        "communicate",                  // friend + backup
        "com.example.demo",             // group
        "coommunicator.connections",    // connections
})
@EnableConfigurationProperties
@EnableScheduling
public class CommunicatorApplication {

    public static void main(String[] args) {
        SpringApplication.run(CommunicatorApplication.class, args);
    }
}
