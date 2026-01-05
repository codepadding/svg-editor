# Browser SVG Editor

> A powerful, in-browser SVG editor built with React and TypeScript. Edit colors, text, attributes, drag shapes, and export instantly—all without leaving your browser.

## What is this?

**Browser SVG Editor** is a free, client-side SVG editing tool that runs entirely in your web browser. No server required, no data sent anywhere. Just upload or paste an SVG and start editing.

### Key Features

- 🎨 **Visual Editing**: Edit colors, opacity, rotation, and text directly in the UI
- 🖱️ **Drag & Drop**: Move shapes around the canvas with your mouse
- ✨ **Multi-Select**: Select multiple shapes with Shift/Ctrl+Click for bulk editing
- 📋 **Undo/Redo**: Full history management with keyboard shortcuts
- 🔍 **Zoom & Pan**: Navigate large SVGs with zoom controls and panning
- 🌳 **Element Tree**: Visual hierarchy view of all SVG elements
- 📤 **Export**: Download as SVG or export to PNG
- 🎯 **Smart Selection**: Visual bounding boxes and handles for selected elements
- ⚡ **Fast & Responsive**: Optimized for performance with debounced updates

## Why should I care?

- **Privacy First**: Everything runs locally in your browser—no uploads, no tracking
- **No Installation**: Just open the app and start editing
- **Free & Open Source**: Modify and extend it however you want
- **Modern Tech Stack**: Built with React, TypeScript, Tailwind CSS, and Vite
- **Well-Structured Code**: Clean, maintainable codebase perfect for learning or contributing

## How do I run it locally?

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd svg-editor

# Install dependencies
yarn install

# Start the development server
yarn dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Available Scripts

- `yarn dev` - Start development server with hot reload
- `yarn build` - Build for production
- `yarn preview` - Preview production build
- `yarn lint` - Run ESLint

## How can I contribute?

**Contributions are welcome!** Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and our [Code of Conduct](./CODE_OF_CONDUCT.md) before submitting a PR.

We welcome contributions! Here's how to get started:

### Getting Started

1. **Fork the repository** and clone your fork
2. **Create a branch** for your feature: `git checkout -b feature/amazing-feature`
3. **Make your changes** and test them locally
4. **Commit your changes**: `git commit -m 'Add amazing feature'`
5. **Push to your fork**: `git push origin feature/amazing-feature`
6. **Open a Pull Request** with a clear description of your changes

### Development Guidelines

- **Code Style**: Follow the existing TypeScript/React patterns
- **Testing**: Test your changes manually in the browser before submitting
- **Type Safety**: Ensure TypeScript compiles without errors (`yarn build`)
- **Responsive Design**: Test on mobile and desktop viewports
- **Accessibility**: Consider keyboard navigation and screen readers

### Areas for Contribution

- 🐛 **Bug Fixes**: Found a bug? Fix it and submit a PR!
- ✨ **New Features**: Ideas for improvements? We'd love to see them
- 📚 **Documentation**: Improve docs, add examples, or write tutorials
- 🎨 **UI/UX**: Enhance the interface and user experience
- ⚡ **Performance**: Optimize rendering or state management
- 🧪 **Tests**: Add unit or integration tests

### Reporting Issues

Found a bug or have a feature request? Open an issue with:
- Clear description of the problem/feature
- Steps to reproduce (if it's a bug)
- Browser and OS information
- Screenshots if applicable

### Questions?

Open an issue with the `question` label, and we'll help you get started!

## Roadmap

We have big plans for Browser SVG Editor! Here's what's coming next. Contributions are welcome for any of these items:

### High Priority

- [ ] **Advanced Path Editing**: Direct manipulation of SVG paths with node editing and bezier curve controls
- [ ] **Layer Management**: Show/hide layers, reorder elements, layer-based grouping
- [ ] **Shape Tools**: Add tools to create new shapes (rectangles, circles, polygons) directly in the editor
- [ ] **SVG Optimization**: Built-in SVG optimization and minification options
- [ ] **Export Presets**: Save and reuse export settings (dimensions, formats, quality)

### Medium Priority

- [ ] **Text Editing Improvements**: Rich text editing with font selection, size controls, and styling
- [ ] **Gradient & Pattern Editor**: Visual editor for gradients and patterns
- [ ] **Snap to Grid/Guides**: Alignment tools with snap-to-grid and guide lines
- [ ] **Copy/Paste Between Sessions**: Persistent clipboard across browser sessions
- [ ] **Animation Support**: Basic SVG animation preview and editing

### Future Ideas

- [ ] **Plugin System**: Extensible architecture for custom tools and features
- [ ] **Collaborative Editing**: Real-time collaboration features
- [ ] **Template Library**: Pre-built SVG templates and clipart
- [ ] **Version History**: Save and restore previous versions of your work
- [ ] **Cloud Sync**: Optional cloud storage integration

Want to work on something? Check out our [Contributing Guide](./CONTRIBUTING.md) and open an issue to discuss your idea!

---

**Built with** ❤️ **using React, TypeScript, Tailwind CSS, and Vite**

