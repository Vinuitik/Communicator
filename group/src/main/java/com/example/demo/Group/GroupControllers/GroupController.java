package com.example.demo.Group.GroupControllers;

import java.util.List;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import com.example.demo.Group.GroupEntities.GroupKnowledge;
import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupServices.GroupKnowledgeService;
import com.example.demo.Group.GroupServices.SocialGroupService;

import lombok.RequiredArgsConstructor;

@Controller
@RequiredArgsConstructor
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
public class GroupController {

    private final SocialGroupService socialGroupService;
    private final GroupKnowledgeService groupKnowledgeService;

    // Handle /api/groups -> group_service/
    @GetMapping("/")
    public String getAllGroups(Model model) {
        List<SocialGroup> groups = socialGroupService.getAllGroups();
        model.addAttribute("groups", groups);
        return "groups/allGroups";
    }

    // Handle /api/groups/create -> group_service/create
    @GetMapping("/create")
    public String showCreateGroupForm(Model model) {
        model.addAttribute("group", SocialGroup.builder().name("").description("").build());
        return "groups/createGroup";
    }


    // Handle /api/groups/{id}/knowledge -> group_service/{id}/knowledge
    @GetMapping("/{id}/knowledge")
    public String getGroupKnowledge(@PathVariable Integer id, Model model) {
        SocialGroup group = socialGroupService.getGroupById(id);
        if (group != null) {
            List<GroupKnowledge> knowledges = groupKnowledgeService.getAllGroupKnowledge(id);
            model.addAttribute("group", group);
            model.addAttribute("groupId", id);
            model.addAttribute("knowledges", knowledges);
            return "groups/groupKnowledge";
        }
        return "redirect:/api/groups";
    }
}
