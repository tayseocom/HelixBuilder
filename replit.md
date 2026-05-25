# HX Preset Generator

## Overview

This is a React-based web application for generating and managing presets for Line 6 Helix guitar processors. The application allows users to create, edit, and export preset configurations with effect blocks, snapshots, and footswitch assignments. It features a modern UI built with React, TypeScript, and shadcn/ui components, backed by an Express.js server with PostgreSQL database integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for development/build tooling
- **UI Library**: shadcn/ui components built on Radix UI primitives with Tailwind CSS styling
- **State Management**: React hooks for local state, TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with custom CSS variables for theming and studio-specific color palette

### Backend Architecture
- **Framework**: Express.js with TypeScript for REST API endpoints
- **Database ORM**: Drizzle ORM with PostgreSQL dialect for type-safe database operations
- **Storage**: Dual storage implementation with in-memory storage for development and PostgreSQL for production
- **API Design**: RESTful endpoints for preset CRUD operations with validation using Zod schemas
- **Development**: Hot module replacement with Vite middleware integration

### Data Models
- **Users**: Basic user authentication schema with username/password
- **Presets**: Complex preset structure containing effect blocks, snapshots, footswitches, and HLX data
- **Effect Blocks**: Individual effect configurations with enable/disable state and position
- **Snapshots**: Named preset variations for quick switching
- **Footswitches**: Configurable pedal assignments for effects or snapshots

### File Architecture
- **Shared Schema**: Common TypeScript types and Zod validation schemas in `/shared`
- **Client**: React application in `/client` with component-based architecture
- **Server**: Express API and storage layer in `/server`
- **Database**: Drizzle migrations and configuration for PostgreSQL

### Key Design Patterns
- **Type Safety**: End-to-end TypeScript with shared schemas between client and server
- **Component Composition**: Reusable UI components following shadcn/ui patterns
- **Separation of Concerns**: Clear separation between UI components, business logic, and data access
- **Local Storage Persistence**: Automatic saving of preset state to browser localStorage
- **File Export/Import**: HLX preset file generation and parsing for hardware compatibility

## External Dependencies

### Core Framework Dependencies
- **React & React DOM**: Frontend framework and rendering
- **Express.js**: Node.js web server framework
- **TypeScript**: Type safety across the application
- **Vite**: Development server and build tool

### Database & ORM
- **Drizzle ORM**: Type-safe database operations
- **@neondatabase/serverless**: PostgreSQL serverless driver
- **Drizzle Kit**: Database migrations and schema management

### UI & Styling
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Headless UI component primitives
- **shadcn/ui**: Pre-built component library
- **Lucide React**: Icon library
- **class-variance-authority**: Component variant styling

### State & Data Management
- **TanStack React Query**: Server state management and caching
- **React Hook Form**: Form handling and validation
- **Zod**: Runtime type validation and schema parsing
- **Wouter**: Lightweight routing

### Development & Build Tools
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production
- **PostCSS & Autoprefixer**: CSS processing
- **@replit/vite-plugin-runtime-error-modal**: Development error handling

## Deployment

The frontend is a static SPA and can be deployed to Cloudflare Pages without the Express server. See `DEPLOY.md` for the full settings. Quick reference:

- Build command: `npm run build`
- Build output directory: `dist/public`
- Node version: `20` (`NODE_VERSION=20`)
- SPA fallback: `client/public/_redirects` ships `/* /index.html 200` so `wouter` routes resolve on hard reloads.

The app stores all state in browser `localStorage` and makes no `/api/*` requests, so the bundled Express server is not required in production.