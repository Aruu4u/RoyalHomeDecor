import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PropsWithChildren } from "react";
import type {
  Session,
  User,
} from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";
import type {
  AuthContextValue,
  SignUpResult,
} from "../types/auth";
import { AuthContext } from "./auth-context";

function userHasAdminRole(
  user: User | null,
): boolean {
  return user?.app_metadata.role === "admin";
}

export function AuthProvider({
  children,
}: PropsWithChildren) {
  const [user, setUser] =
    useState<User | null>(null);

  const [session, setSession] =
    useState<Session | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  useEffect(() => {
    async function loadSession(): Promise<void> {
      const { data, error } =
        await supabase.auth.getSession();

      if (error) {
        console.error(
          "Unable to load session:",
          error.message,
        );
      }

      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    }

    void loadSession();

    const { data: authListener } =
      supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          setSession(nextSession);
          setUser(nextSession?.user ?? null);
          setIsLoading(false);
        },
      );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(
    email: string,
    password: string,
  ): Promise<void> {
    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      throw new Error(error.message);
    }
  }

  async function signUp(
    email: string,
    password: string,
  ): Promise<SignUpResult> {
    const { data, error } =
      await supabase.auth.signUp({
        email,
        password,
      });

    if (error) {
      throw new Error(error.message);
    }

    return {
      requiresEmailConfirmation:
        data.session === null,
    };
  }

  async function signOut(): Promise<void> {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }
  }

  const isAdmin =
    userHasAdminRole(user);

  const value =
    useMemo<AuthContextValue>(
      () => ({
        user,
        session,
        isLoading,
        isAdmin,
        signIn,
        signUp,
        signOut,
      }),
      [
        user,
        session,
        isLoading,
        isAdmin,
      ],
    );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}