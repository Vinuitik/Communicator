# React Microservice Documentation

This README provides an overview of the React microservice built with TypeScript and Tailwind CSS, following the Atomic Design principles.

## Project Structure

The project is organized according to the Atomic Design methodology, which categorizes components into five distinct levels:

- **Atoms**: Basic building blocks of the application (e.g., buttons, inputs).
- **Molecules**: Combinations of atoms that form functional units (e.g., search bars, form fields).
- **Organisms**: Groups of molecules that form distinct sections of the UI (e.g., headers, navigation bars).
- **Templates**: Page-level components that define the layout (e.g., page layouts).
- **Pages**: Specific views that represent the application’s routes (e.g., home page, friends page).

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- Yarn (for package management)

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd react
   ```

2. Install dependencies:
   ```
   yarn install
   ```

### Development

To start the development server, run:
```
yarn start
```
This will launch the application in development mode. Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### Building for Production

To create a production build, run:
```
yarn build
```
This will generate optimized static files in the `build` directory.

## Docker Setup

The project includes a Dockerfile for containerization. To build and run the Docker container, use the following commands:

1. Build the Docker image:
   ```
   docker build -t react-ui .
   ```

2. Run the Docker container:
   ```
   docker run -p 80:80 react-ui
   ```

## Tailwind CSS

This project uses Tailwind CSS for styling. You can customize the styles in the `tailwind.config.js` file.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.