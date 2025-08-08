package com.example.demo.Group.GroupControllers;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupServices.SocialGroupService;

import lombok.RequiredArgsConstructor;

@Controller
@RequiredArgsConstructor
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
public class GroupController {

    private final SocialGroupService socialGroupService;

    @GetMapping("/groups")
    public String getAllGroups(Model model) {
        List<SocialGroup> groups = socialGroupService.getAllGroups();
        model.addAttribute("groups", groups);
        return "groups/allGroups";
    }

    @GetMapping("/groups/create")
    public String showCreateGroupForm(Model model) {
        model.addAttribute("group", new SocialGroup());
        return "groups/createGroup";
    }

    @PostMapping("/groups/create")
    public String createGroup(@ModelAttribute SocialGroup group, RedirectAttributes redirectAttributes) {
        try {
            SocialGroup savedGroup = socialGroupService.createGroup(group);
            redirectAttributes.addFlashAttribute("success", "Group created successfully!");
            return "redirect:/groups";
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", "Failed to create group: " + e.getMessage());
            return "redirect:/groups/create";
        }
    }

    @GetMapping("/groups/{id}")
    public String getGroupDetails(@PathVariable Integer id, Model model) {
        SocialGroup group = socialGroupService.getGroupById(id);
        if (group != null) {
            model.addAttribute("group", group);
            return "groups/groupDetails";
        }
        return "redirect:/groups";
    }

    @PostMapping("/groups/{id}/delete")
    public String deleteGroup(@PathVariable Integer id, RedirectAttributes redirectAttributes) {
        try {
            boolean deleted = socialGroupService.deleteGroup(id);
            if (deleted) {
                redirectAttributes.addFlashAttribute("success", "Group deleted successfully!");
            } else {
                redirectAttributes.addFlashAttribute("error", "Group not found!");
            }
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("error", "Failed to delete group: " + e.getMessage());
        }
        return "redirect:/groups";
    }
}
