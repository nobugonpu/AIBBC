import { LogOut, Upload, Home as HomeIcon, Images, Calendar, Users } from 'lucide-react';

type Page = 'home' | 'upload' | 'gallery' | 'treatment' | 'patients';

interface NavigationBarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
  onSignOut: () => void;
}

export function NavigationBar({ currentPage, onPageChange, onSignOut }: NavigationBarProps) {
  return (
    <div className="flex items-center gap-3">
      <nav className="flex gap-2 bg-white border border-gray-300 rounded-lg p-1 shadow-sm">
        <button
          onClick={() => onPageChange('home')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            currentPage === 'home'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <HomeIcon className="h-4 w-4" />
          Home
        </button>
        <button
          onClick={() => onPageChange('upload')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            currentPage === 'upload'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Upload className="h-4 w-4" />
          Upload Media
        </button>
        <button
          onClick={() => onPageChange('gallery')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            currentPage === 'gallery'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Images className="h-4 w-4" />
          Gallery
        </button>
        <button
          onClick={() => onPageChange('treatment')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            currentPage === 'treatment'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Treatment
        </button>
        <button
          onClick={() => onPageChange('patients')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            currentPage === 'patients'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Users className="h-4 w-4" />
          Patients
        </button>
      </nav>
      <button
        onClick={onSignOut}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors shadow-sm"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>
    </div>
  );
}
