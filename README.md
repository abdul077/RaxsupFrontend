# RaxsUp Frontend

Angular frontend application for the RaxsUp Load Management System, styled with Falcon-inspired design.

## Technology Stack

- **Angular 20.3**: Latest Angular framework
- **TypeScript**: Type-safe JavaScript
- **Bootstrap 5**: UI framework
- **Font Awesome**: Icon library
- **RxJS**: Reactive programming
- **Angular Router**: Client-side routing with lazy loading

## Design System

The application uses a **Falcon-inspired design** based on the [Falcon Admin Template](https://prium.github.io/falcon/v3.25.0/widgets.html), featuring:

- **Vertical Sidebar Navigation**: Fixed sidebar with icon-based navigation
- **Top Bar**: Header with user profile and notifications
- **Modern Cards**: Clean card-based layouts for content
- **Gradient Stats Cards**: Beautiful gradient cards for dashboard statistics
- **Responsive Design**: Mobile-friendly responsive layout

## Project Structure

```
src/
├── app/
│   ├── core/                    # Core functionality
│   │   ├── guards/              # Route guards (auth, role)
│   │   ├── interceptors/         # HTTP interceptors (JWT)
│   │   ├── models/              # TypeScript interfaces/models
│   │   └── services/            # Core services (auth, API)
│   ├── features/                # Feature modules (lazy loaded)
│   │   ├── auth/                # Authentication
│   │   ├── dashboard/           # Dashboard
│   │   ├── loads/               # Load management
│   │   ├── drivers/             # Driver management
│   │   ├── customers/           # Customer management
│   │   ├── equipment/          # Equipment management
│   │   ├── financial/           # Financial management
│   │   ├── compliance/          # Compliance & safety
│   │   ├── admin/               # Admin functions
│   │   └── reports/             # Reporting
│   ├── shared/                  # Shared components
│   │   └── components/         # Reusable components
│   │       ├── layout/         # Main layout wrapper
│   │       ├── sidebar/        # Sidebar navigation
│   │       └── topbar/         # Top navigation bar
│   ├── app.config.ts            # App configuration
│   └── app.routes.ts            # Main routing configuration
└── environments/                # Environment configurations
```

## Features

- ✅ **Falcon-Inspired Design**: Modern, professional admin dashboard design
- ✅ **Modular Architecture**: Feature-based modules with lazy loading
- ✅ **JWT Authentication**: Secure token-based authentication
- ✅ **Role-Based Access Control**: Route guards based on user roles
- ✅ **HTTP Interceptors**: Automatic JWT token injection
- ✅ **Responsive Design**: Mobile-friendly responsive UI
- ✅ **Type Safety**: Full TypeScript support with interfaces
- ✅ **Icon Support**: Font Awesome icons throughout

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)

### Installation

1. Install dependencies:
```bash
npm install
```

### Development

1. Start the development server:
```bash
npm start
```

2. Navigate to `http://localhost:4200/`

### Build

Build for production:
```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Configuration

### Environment Variables

Update `src/environments/environment.ts` with your API URL:

```typescript
export const environment = {
  production: false,
  apiUrl: 'https://localhost:5001/api'  // Your backend API URL
};
```

## Layout Structure

The application uses a **vertical sidebar layout** inspired by Falcon:

- **Sidebar**: Fixed left sidebar (280px) with navigation menu
- **Topbar**: Fixed top header (60px) with user profile dropdown
- **Content Area**: Main content area with padding

## Design Features

### Color Scheme
- **Primary**: `#2c7be5` (Blue)
- **Success**: `#00d97e` (Green)
- **Info**: `#39afd1` (Cyan)
- **Warning**: `#f6c23e` (Yellow)
- **Danger**: `#e63757` (Red)
- **Dark**: `#12263f` (Dark Blue)

### Typography
- **Font Family**: Nunito Sans
- **Base Font Size**: 0.875rem (14px)

### Components
- **Cards**: Clean white cards with subtle shadows
- **Stats Cards**: Gradient cards for dashboard statistics
- **Forms**: Bootstrap-styled forms with icons
- **Tables**: Clean tables with hover effects
- **Buttons**: Rounded buttons with consistent styling

## Features by Module

### Authentication (`/auth`)
- Modern login page with Falcon styling
- JWT token management
- User session handling

### Dashboard (`/dashboard`)
- Overview statistics with gradient cards
- Quick access to key metrics
- Recent activity feed

### Loads (`/loads`)
- List all loads
- Create new loads
- Update load status
- Assign loads to drivers

### Drivers (`/drivers`)
- Driver management
- Driver performance tracking

### Customers (`/customers`)
- Customer list
- Customer management

### Equipment (`/equipment`)
- Equipment tracking
- Maintenance logs

### Financial (`/financial`)
- Invoice management
- Payment tracking

### Compliance (`/compliance`)
- Incident reporting
- Safety training
- Violation tracking

### Admin (`/admin`)
- User management
- Role management

### Reports (`/reports`)
- Dashboard statistics
- Load reports
- Analytics

## Role-Based Access

The application implements role-based access control:

- **Admin**: Full access to all features
- [`Dispatcher`]: Load management, drivers, customers
- **Driver**: View assigned loads, update status
- **Accountant**: Financial, customers, reports
- **FleetManager**: Equipment, compliance, drivers

## API Integration

The frontend communicates with the backend API through:

- **ApiService**: Base HTTP service for API calls
- **AuthService**: Authentication and user management
- **HTTP Interceptors**: Automatic JWT token injection

## Development Notes

- All feature modules use lazy loading for optimal performance
- Components use standalone component architecture
- Services are provided at root level for singleton behavior
- Guards protect routes based on authentication and roles
- Falcon-inspired design system for consistent UI/UX

## License

This project is part of the RaxsUp Load Management System.
