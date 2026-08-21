package communicate.Friend.FriendService;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

/** Runs FsrsBackfillService.backfillAll() once per boot — see its class doc for why this is safe to leave permanent. */
@Component
@RequiredArgsConstructor
public class FsrsBackfillRunner implements ApplicationRunner {

    private final FsrsBackfillService backfillService;

    @Override
    public void run(ApplicationArguments args) {
        backfillService.backfillAll();
    }
}
