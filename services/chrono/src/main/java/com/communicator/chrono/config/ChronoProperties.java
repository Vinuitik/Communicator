package com.communicator.chrono.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "chrono")
public class ChronoProperties {

    // Decay-alpha lookup used to live here (chrono.coefficients.decay) as a
    // second copy of the same table friend module's EmaProperties already
    // held (ema.coefficients.newData). Now sourced from a single place —
    // EmaProperties.getDecayAlpha — since chrono already depends on the
    // friend module's beans and the friend module can't depend back on
    // chrono (needed the timeline/series endpoint to read the same alpha
    // table too). See application.yml: ema.coefficients.decay.

    private String schedule;
    private FriendService friendService;

    @Data
    public static class FriendService {
        private int batchSize = 200; // Default batch size for interaction checks
        private int friendPageSize = 500; // Default page size for friend pagination
    }
}
