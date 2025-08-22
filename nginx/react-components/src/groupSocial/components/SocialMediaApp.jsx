/**
 * Social Media Management Application
 * Reusable app for managing social media links in any context
 */

import React, { useState, useEffect } from 'react';
import Navigation from './NavBar.jsx';
import SocialMediaForm from './SocialMediaForm.jsx';
import SocialMediaList from './SocialMediaList.jsx';
import MessageDisplay from './MessageDisplay.jsx';
import Modal from './Modal.jsx';
import Card from './Card.jsx';
import { GroupSocialAPIService } from '../services/GroupSocialAPIService.js';
import { useMessageManager } from '../utils/useMessageManager.js';
import { URLHelper } from '../utils/URLHelper.js';

const SocialMediaApp = ({ 
    title = '🔗 Social Media Links',
    subtitle = 'Manage social media links',
    entityId = null, // Could be groupId, userId, etc.
    entityLabel = 'Group ID',
    apiService = GroupSocialAPIService
}) => {
    // State management
    const [socials, setSocials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formLoading, setFormLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSocial, setEditingSocial] = useState(null);
    const [currentEntityId, setCurrentEntityId] = useState(entityId);

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
        const idFromURL = entityId || URLHelper.getGroupIdFromURL();
        
        if (!idFromURL) {
            showError('Entity ID not found in URL. Please provide a valid ID.');
            setLoading(false);
            return;
        }

        setCurrentEntityId(idFromURL);
        loadSocials(idFromURL);
    }, [entityId]);

    // Load social links for the entity
    const loadSocials = async (entityIdParam) => {
        try {
            setLoading(true);
            const socialData = await apiService.getSocialsForGroup(entityIdParam);
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
            const newSocial = await apiService.createSocial(currentEntityId, formData);
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
            const updatedSocial = await apiService.updateSocial(editingSocial.id, formData);
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
            await apiService.deleteSocial(social.id);
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

    return (
        <div className="min-h-screen bg-background text-text-primary font-sans">
            <Navigation />
            
            <div className="max-w-6xl mx-auto px-6 pt-20 pb-8">
                <header className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-text-primary mb-2">{title}</h1>
                    <p className="text-lg text-text-secondary mb-4">{subtitle}</p>
                    {currentEntityId && (
                        <div className="inline-block bg-surface border border-border-light rounded-card px-4 py-2 shadow-card">
                            <span className="text-sm font-medium text-text-secondary">{entityLabel}: </span>
                            <span className="text-sm font-bold text-primary-500">{currentEntityId}</span>
                        </div>
                    )}
                </header>

                <MessageDisplay message={message} onClose={clearMessage} />

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
                        <p className="mt-4 text-text-secondary">Loading social links...</p>
                    </div>
                ) : currentEntityId ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        <Card title="Add New Social Media">
                            <SocialMediaForm
                                onSubmit={handleAddSocial}
                                onCancel={() => {}}
                                initialData={null}
                                isLoading={formLoading}
                            />
                        </Card>

                        <Card title="Existing Social Media">
                            <SocialMediaList
                                socials={socials}
                                onEdit={openEditModal}
                                onDelete={handleDeleteSocial}
                                isLoading={false}
                            />
                        </Card>
                    </div>
                ) : (
                    <Card>
                        <div className="text-center py-16">
                            <div className="text-6xl mb-4">❌</div>
                            <h2 className="text-2xl font-bold text-text-primary mb-2">Error</h2>
                            <p className="text-text-secondary">Unable to load social links. Please check the URL and try again.</p>
                        </div>
                    </Card>
                )}

                {/* Add/Edit Modal */}
                <Modal
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    title={editingSocial ? 'Edit Social Link' : 'Add New Social Link'}
                >
                    <SocialMediaForm
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

export default SocialMediaApp;
