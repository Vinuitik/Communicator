/**
 * Modal Manager for handling modal dialogs
 */

export class ModalManager {
    /**
     * Show edit modal with social data
     * @param {Object} social Social media data
     */
    static showEditModal(social) {
        document.getElementById('editSocialId').value = social.id;
        document.getElementById('editPlatform').value = social.platform;
        document.getElementById('editUrl').value = social.URL;
        document.getElementById('editDisplayName').value = social.displayName || '';
        
        document.getElementById('editModal').style.display = 'flex';
    }

    /**
     * Hide edit modal
     */
    static hideEditModal() {
        document.getElementById('editModal').style.display = 'none';
        document.getElementById('editSocialForm').reset();
    }

    /**
     * Show delete confirmation modal
     * @param {string} socialId Social media link ID
     * @param {Function} confirmCallback Callback function for confirmation
     */
    static showDeleteModal(socialId, confirmCallback) {
        document.getElementById('deleteModal').style.display = 'flex';
        document.getElementById('confirmDelete').onclick = () => {
            confirmCallback(socialId);
        };
    }

    /**
     * Hide delete confirmation modal
     */
    static hideDeleteModal() {
        document.getElementById('deleteModal').style.display = 'none';
    }
}
