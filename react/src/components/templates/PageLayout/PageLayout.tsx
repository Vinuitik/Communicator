import React from 'react';
import NavigationBar from '../../organisms/NavigationBar';

const PageLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div className="min-h-screen flex flex-col">
            <NavigationBar />
            <main className="flex-grow w-11/12 max-w-5xl mx-auto py-8">
                {children}
            </main>
        </div>
    );
};

export default PageLayout;