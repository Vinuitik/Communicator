# React Microservice - Communicator UI

A modern React microservice built with TypeScript, Tailwind CSS, and Atomic Design patterns.

## Features

- ⚛️ React 18 with TypeScript
- 🎨 Tailwind CSS for styling
- 🏗️ Atomic Design component architecture
- 📦 Vite for fast development and building
- 🐳 Docker containerization
- 🔧 ESLint for code quality
- 📱 Responsive design patterns

## Project Structure

```
src/
├── components/
│   ├── atoms/          # Basic building blocks (Button, Input, etc.)
│   ├── molecules/      # Simple groups of atoms (SearchBox, Card, etc.)
│   ├── organisms/      # Complex components (Header, Sidebar, etc.)
│   ├── templates/      # Page layouts
│   └── pages/          # Complete page components
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
└── services/           # API services and external integrations
```

## Development

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Docker

Build and run with Docker:
```bash
docker build -t communicator-react .
docker run -p 3000:80 communicator-react
```

## Atomic Design Pattern

This project follows the Atomic Design methodology:

- **Atoms**: Basic HTML elements like buttons, inputs, labels
- **Molecules**: Simple combinations of atoms (e.g., search form)
- **Organisms**: Complex components made of molecules and atoms
- **Templates**: Page layouts that define content structure
- **Pages**: Specific instances of templates with actual content

## Contributing

1. Follow the established component structure
2. Use TypeScript for all components
3. Apply Tailwind CSS classes for styling
4. Ensure responsive design
5. Add proper accessibility attributes
