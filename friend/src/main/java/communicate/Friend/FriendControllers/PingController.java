package communicate.Friend.FriendControllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Cheap, unauthenticated reachability probe for the offline-write outbox
 * (react/src/pwa/connectivity.ts). Lives in the friend module (not bootstrap)
 * so it inherits the already-proxied /api/friend prefix from PathPrefixConfig
 * instead of needing a new nginx location block. No DB access, no side effects.
 */
@RestController
public class PingController {

    @GetMapping("ping")
    public ResponseEntity<Void> ping() {
        return ResponseEntity.ok().build();
    }
}
