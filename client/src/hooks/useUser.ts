import { useAuth } from './useAuth';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function useUser() {
  const { user } = useAuth();
  
  // Type assertion to handle the user object properly
  const typedUser = user as User | null;
  
  return {
    user: typedUser,
    isAuthenticated: !!typedUser,
    displayName: typedUser?.firstName && typedUser?.lastName 
      ? `${typedUser.firstName} ${typedUser.lastName}`
      : typedUser?.email || 'User',
    initials: typedUser?.firstName && typedUser?.lastName
      ? `${typedUser.firstName[0]}${typedUser.lastName[0]}`.toUpperCase()
      : typedUser?.email?.substring(0, 2).toUpperCase() || 'U',
  };
} 