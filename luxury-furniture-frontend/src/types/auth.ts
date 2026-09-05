import type {
  Session,
  User,
} from "@supabase/supabase-js";

export interface SignUpResult {
  requiresEmailConfirmation: boolean;
}

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;

  signIn: (
    email: string,
    password: string,
  ) => Promise<void>;

  signUp: (
    email: string,
    password: string,
  ) => Promise<SignUpResult>;

  signOut: () => Promise<void>;
}