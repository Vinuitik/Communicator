import React from 'react';
import NavigationBar from '../../organisms/NavigationBar';

const PageLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div className="min-h-screen flex flex-col bg-bg">
            <NavigationBar />
            <main className="flex-grow min-h-0">
                {children}
            </main>
        </div>
    );
};

export default PageLayout;