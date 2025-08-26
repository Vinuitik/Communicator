/**
 * GroupSocialPage - Main page component for Group Social Media Management
 * Orchestrates all organisms to create the complete page experience
 */

import React, { useState, useEffect } from 'react';
import { MessageDisplay, Button } from '../atoms';
import { Modal, NavBar, GroupSocialForm, GroupSocialList } from '../organisms';
import { GroupSocialAPIService } from '../groupSocial/services/GroupSocialAPIService.js';
import { useMessageManager } from '../groupSocial/utils/useMessageManager.js';
import { URLHelper } from '../groupSocial/utils/URLHelper.js';

const GroupSocialPage = () => {
    // State management
    const [socials, setSocials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formLoading, setFormLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSocial, setEditingSocial] = useState(null);
    const [groupId, setGroupId] = useState(null);

    // Message management
    const { 
        message, 
        showSuccess, 
        showError, 
        showWarning,
        clearMessage 
    } = useMessageManager();

    // Initialize component
    useEffect(() => {
        const groupIdFromURL = URLHelper.getGroupIdFromURL();
        
        if (!groupIdFromURL) {
            showError('Group ID not found in URL. Please provide a valid group ID.');
            setLoading(false);
            return;
        }

        setGroupId(groupIdFromURL);
        loadSocials(groupIdFromURL);
    }, []);

    // Load social links for the group
    const loadSocials = async (groupIdParam) => {
        try {
            setLoading(true);
            const response = await GroupSocialAPIService.getSocials(groupIdParam || groupId);
            
            if (response.success) {
                setSocials(response.data || []);
            } else {
                showError(response.error || 'Failed to load social links');
            }
        } catch (error) {
            console.error('Error loading socials:', error);
            showError('Failed to load social links. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Handle adding a new social link
    const handleAddSocial = async (formData) => {
        try {
            setFormLoading(true);
            const response = await GroupSocialAPIService.createSocial(groupId, formData);
            
            if (response.success) {
                setSocials(prev => [...prev, response.data]);
                setIsModalOpen(false);
                setEditingSocial(null);
                showSuccess('Social link added successfully!');
            } else {
                showError(response.error || 'Failed to add social link');
            }
        } catch (error) {
            console.error('Error adding social:', error);
            showError('Failed to add social link. Please try again.');
        } finally {
            setFormLoading(false);
        }
    };

    // Handle editing a social link
    const handleEditSocial = async (formData) => {
        try {
            setFormLoading(true);
            const response = await GroupSocialAPIService.updateSocial(editingSocial.id, formData);
            
            if (response.success) {
                setSocials(prev => prev.map(social => 
                    social.id === editingSocial.id ? response.data : social
                ));
                setIsModalOpen(false);
                setEditingSocial(null);
                showSuccess('Social link updated successfully!');
            } else {
                showError(response.error || 'Failed to update social link');
            }
        } catch (error) {
            console.error('Error updating social:', error);
            showError('Failed to update social link. Please try again.');
        } finally {
            setFormLoading(false);
        }
    };

    // Handle deleting a social link
    const handleDeleteSocial = async (socialId) => {
        if (!confirm('Are you sure you want to delete this social link?')) {
            return;
        }

        try {
            const response = await GroupSocialAPIService.deleteSocial(socialId);
            
            if (response.success) {
                setSocials(prev => prev.filter(social => social.id !== socialId));
                showSuccess('Social link deleted successfully!');
            } else {
                showError(response.error || 'Failed to delete social link');
            }
        } catch (error) {
            console.error('Error deleting social:', error);
            showError('Failed to delete social link. Please try again.');
        }
    };

    // Open modal for adding new social
    const openAddModal = () => {
        setEditingSocial(null);
        setIsModalOpen(true);
    };

    // Open modal for editing social
    const openEditModal = (social) => {
        setEditingSocial(social);
        setIsModalOpen(true);
    };

    // Close modal
    const closeModal = () => {
        setIsModalOpen(false);
        setEditingSocial(null);
    };

    // Handle form submission
    const handleFormSubmit = (formData) => {
        if (editingSocial) {
            handleEditSocial(formData);
        } else {
            handleAddSocial(formData);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation */}
            <NavBar title="Group Social Media" />
            
            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Page Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Social Media Links</h1>
                        <p className="text-gray-600 mt-2">Manage social media connections for this group</p>
                    </div>
                    <Button
                        variant="primary"
                        onClick={openAddModal}
                        className="flex items-center"
                    >
                        <span className="mr-2">+</span>
                        Add Social Link
                    </Button>
                </div>

                {/* Messages */}
                {message && (
                    <div className="mb-6">
                        <MessageDisplay 
                            message={message} 
                            onClose={clearMessage}
                        />
                    </div>
                )}

                {/* Social Links List */}
                <GroupSocialList
                    socials={socials}
                    onEdit={openEditModal}
                    onDelete={handleDeleteSocial}
                    isLoading={loading}
                />

                {/* Add/Edit Modal */}
                <Modal
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    title={editingSocial ? 'Edit Social Link' : 'Add New Social Link'}
                    size="lg"
                >
                    <GroupSocialForm
                        onSubmit={handleFormSubmit}
                        onCancel={closeModal}
                        initialData={editingSocial}
                        isLoading={formLoading}
                    />
                </Modal>
            </div>
        </div>
    );
};

export default GroupSocialPage;