import { useParams } from 'react-router-dom';
import { Navigation } from '@/components/organisms/Navigation';

/**
 * GroupSocialPage - Social media management for groups
 * For now, just contains the navigation bar to test our organism
 */
export function GroupSocialPage() {
  // Get the groupId from the URL parameter
  const { groupId } = useParams();
  
  // Handle navigation clicks (for now just console log)
  const handleNavigation = (href: string, id?: string) => {
    console.log('Navigation clicked:', { href, id });
    // In a real app, this would handle routing
    // For now, we'll just log it since we're using traditional navigation
  };

  // Simple navigation items
  const navItems = [
    { href: '/', label: 'Home' },
    { href: `/group/${groupId}/social`, label: 'Group Social', active: true },
    { href: '/groups', label: 'All Groups' }
  ];
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <Navigation
        logo="Friends Tracker"
        items={navItems}
        activeRoute={`/group/${groupId}/social`}
        onLinkClick={handleNavigation}
      />
      
      {/* Temporary content to show the page is working */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-gray-900 mb-4">
            Group Social Media Management
          </h1>
          <p className="text-gray-600 mb-8">
            Navigation organism is working! 🎉
          </p>
          <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
            <h2 className="text-xl font-medium text-gray-800 mb-2">
              Coming Soon
            </h2>
            <p className="text-gray-600">
              This page will contain forms and lists for managing group social media links.
              For now, we're testing our Navigation organism.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
