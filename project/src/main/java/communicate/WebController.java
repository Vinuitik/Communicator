package communicate;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import lombok.RequiredArgsConstructor;

@Controller
@RequiredArgsConstructor
public class WebController {

    private final FriendService friendService;
    private final FriendRepository friendRepository;

    @GetMapping("/talked/{id}")
    public String showFriendForm(@PathVariable(required = false) Integer id, Model model) {
        Friend friend = id != null ? friendRepository.findById(id).orElse(new Friend()) : new Friend();
        model.addAttribute("friend", friend);
        return "talkedForm"; // Your Thymeleaf template name
    }

    @GetMapping("index")
    public String getMethodName() {
        return "forward:/index.html";
    }
    
}
