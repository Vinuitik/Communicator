/**
 * Main Group Social Media Management Component
 */

import React, { useState, useEffect } from 'react';
import { GroupSocialAPIService } from '../services/GroupSocialAPIService.js';
import { useMessageManager } from '../utils/useMessageManager.js';
import { URLHelper } from '../utils/URLHelper.js';
import MessageDisplay from './MessageDisplay.jsx';
import Modal from './Modal.jsx';
import GroupSocialForm from './GroupSocialForm.jsx';
import GroupSocialList from './GroupSocialList.jsx';
import NavBar from './NavBar.jsx';

const GroupSocialApp = () => {
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
            const socialData = await GroupSocialAPIService.getSocialsForGroup(groupIdParam);
            setSocials(socialData);
        } catch (error) {
            showError(error.message);
            setSocials([]);
        } finally {
            setLoading(false);
        }
    };

    // Handle adding new social link
    const handleAddSocial = async (formData) => {
        try {
            setFormLoading(true);
            const newSocial = await GroupSocialAPIService.createSocial(groupId, formData);
            setSocials(prev => [...prev, newSocial]);
            showSuccess(`${formData.platform} link added successfully!`);
            closeModal();
        } catch (error) {
            showError(error.message);
        } finally {
            setFormLoading(false);
        }
    };

    // Handle editing social link
    const handleEditSocial = async (formData) => {
        try {
            setFormLoading(true);
            const updatedSocial = await GroupSocialAPIService.updateSocial(editingSocial.id, formData);
            setSocials(prev => 
                prev.map(social => 
                    social.id === editingSocial.id ? updatedSocial : social
                )
            );
            showSuccess(`${formData.platform} link updated successfully!`);
            closeModal();
        } catch (error) {
            showError(error.message);
        } finally {
            setFormLoading(false);
        }
    };

    // Handle deleting social link
    const handleDeleteSocial = async (social) => {
        if (!window.confirm(`Are you sure you want to delete the ${social.platform} link?`)) {
            return;
        }

        try {
            await GroupSocialAPIService.deleteSocial(social.id);
            setSocials(prev => prev.filter(s => s.id !== social.id));
            showSuccess(`${social.platform} link deleted successfully!`);
        } catch (error) {
            showError(error.message);
        }
    };

    // Modal management
    const openAddModal = () => {
        setEditingSocial(null);
        setIsModalOpen(true);
    };

    const openEditModal = (social) => {
        setEditingSocial(social);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingSocial(null);
        setFormLoading(false);
    };

    // Form submission handler
    const handleFormSubmit = (formData) => {
        if (editingSocial) {
            handleEditSocial(formData);
        } else {
            handleAddSocial(formData);
        }
    };

    // If no group ID, show error state
    if (!groupId && !loading) {
        return (
            <div className="social-app">
                <div className="container">
                    <MessageDisplay message={message} onClose={clearMessage} />
                    <div className="error-state">
                        <h2>❌ Error</h2>
                        <p>Unable to load group social links. Please check the URL and try again.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
            <NavBar />
            <div className="max-w-6xl mx-auto px-4 py-20">
                <header className="text-center mb-8">
                    <h1 className="text-3xl font-semibold">🔗 Group Social Links</h1>
                    <p className="text-sm text-gray-500 mt-2">Manage social media links for this group</p>
                    {groupId && (
                        <div className="mt-3">
                            <span className="inline-block bg-white border border-gray-200 rounded-md px-3 py-1 text-sm text-gray-600">Group ID: {groupId}</span>
                        </div>
                    )}
                </header>

                <MessageDisplay message={message} onClose={clearMessage} />

                {!loading && groupId && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold mb-4">Add New Social Media</h2>
                            <GroupSocialForm
                                onSubmit={handleAddSocial}
                                onCancel={() => {}}
                                initialData={null}
                                isLoading={formLoading}
                            />
                        </div>

                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold mb-4">Existing Social Media</h2>
                            <GroupSocialList
                                socials={socials}
                                onEdit={openEditModal}
                                onDelete={handleDeleteSocial}
                                isLoading={loading}
                            />
                        </div>
                    </div>
                )}

                {/* Add/Edit Modal */}
                <Modal
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    title={editingSocial ? 'Edit Social Link' : 'Add New Social Link'}
                    className="social-modal"
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

export default GroupSocialApp;
