package communicate.Friend.FriendService;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

/** Runs SchedulingRolePresetSeedService.seedDefaults() once per boot — see its class doc for why this is safe to leave permanent. */
@Component
@RequiredArgsConstructor
public class SchedulingRolePresetSeedRunner implements ApplicationRunner {

    private final SchedulingRolePresetSeedService seedService;

    @Override
    public void run(ApplicationArguments args) {
        seedService.seedDefaults();
    }
}
