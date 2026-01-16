/**
 * Authentication type definitions
 */

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
}

export interface Organization {
  id: string;
  name?: string;
  role: string;
}

export interface SessionData {
  authenticated: boolean;
  user?: User;
  orgs?: Organization[];
  idToken?: string;
  needsRefresh?: boolean;
}
