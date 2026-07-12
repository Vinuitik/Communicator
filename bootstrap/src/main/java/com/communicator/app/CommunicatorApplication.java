package com.communicator.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Single entrypoint for the Communicator JVM monolith.
 *
 * Business modules live in their own Maven modules under their original base
 * packages; this class component-scans across all of them. As each module is
 * folded in, add its base package to the scanBasePackages list below (and, if it
 * has JPA entities/repositories, to the @EntityScan / @EnableJpaRepositories
 * lists once those are introduced).
 *
 * To add a module: add the Maven dependency in bootstrap/pom.xml, then add its
 * base package here.
 */
@SpringBootApplication(scanBasePackages = {
        "com.communicator.app",
})
@EnableConfigurationProperties
@EnableScheduling
public class CommunicatorApplication {

    public static void main(String[] args) {
        SpringApplication.run(CommunicatorApplication.class, args);
    }
}
