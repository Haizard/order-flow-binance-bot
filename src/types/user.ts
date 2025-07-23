
export interface User {
  id: string;
  email: string;
  password?: string; // Should only be present on the server when creating/finding
}

export type NewUserInput = Pick<User, 'email' | 'password'>;
