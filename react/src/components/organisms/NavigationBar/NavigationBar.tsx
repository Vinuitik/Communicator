import React from 'react';

const NavigationBar: React.FC = () => {
    return (
        <nav className="bg-gray-800 p-4">
            <div className="container mx-auto flex justify-between">
                <div className="text-white text-lg font-bold">MyApp</div>
                <div className="space-x-4">
                    <a href="/" className="text-gray-300 hover:text-white">Home</a>
                    <a href="/friends" className="text-gray-300 hover:text-white">Friends</a>
                    <a href="/groups" className="text-gray-300 hover:text-white">Groups</a>
                </div>
            </div>
        </nav>
    );
};

export default NavigationBar;