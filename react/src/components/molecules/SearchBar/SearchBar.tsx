import React from 'react';
import Input from '../../atoms/Input';
import Button from '../../atoms/Button';

const SearchBar: React.FC = () => {
    const [query, setQuery] = React.useState('');

    const handleSearch = () => {
        // Implement search functionality here
        console.log('Searching for:', query);
    };

    return (
        <div className="flex items-center">
            <Input 
                type="text" 
                placeholder="Search..." 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
                className="mr-2"
            />
            <Button onClick={handleSearch}>Search</Button>
        </div>
    );
};

export default SearchBar;