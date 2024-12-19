package communicate.OLD;

import javax.swing.*;
import java.awt.*;
import java.time.LocalDate;
import communicate.Friend;
import communicate.MongoDB;

public class AddFriendPanel extends JPanel {
    private FriendReminderUI mainFrame;

    public AddFriendPanel(FriendReminderUI mainFrame) {
        this.mainFrame = mainFrame;
        MongoDB mongoDB = mainFrame.getMongoDB();
        setLayout(new GridLayout(6, 2, 10, 10));

        // Form fields
        JLabel nameLabel = new JLabel("Name:");
        JTextField nameField = new JTextField();
        JLabel lastTimeSpokenLabel = new JLabel("Last Time Spoken (YYYY-MM-DD):");
        JTextField lastTimeSpokenField = new JTextField();
        JLabel experienceLabel = new JLabel("Experience:");
        JTextField experienceField = new JTextField();
        JLabel dateOfBirthLabel = new JLabel("Date of Birth (YYYY-MM-DD):");
        JTextField dateOfBirthField = new JTextField();
        
        JButton submitButton = new JButton("Add Friend");

        // Add components to the panel
        add(nameLabel);
        add(nameField);
        add(lastTimeSpokenLabel);
        add(lastTimeSpokenField);
        add(experienceLabel);
        add(experienceField);
        add(dateOfBirthLabel);
        add(dateOfBirthField);
        add(submitButton);

        // Action listener for the submit button
        submitButton.addActionListener(e -> {
            String name = nameField.getText();
            LocalDate lastTimeSpoken = LocalDate.parse(lastTimeSpokenField.getText());
            String experience = experienceField.getText();
            LocalDate dateOfBirth = LocalDate.parse(dateOfBirthField.getText());

            Friend friend = new Friend(name, lastTimeSpoken, experience, dateOfBirth);
            mongoDB.insertFriend(friend);

            JOptionPane.showMessageDialog(mainFrame, "Friend added successfully!");
            mainFrame.setContentPane(new MainPanel(mainFrame));
            mainFrame.revalidate();
        });
    }
}

