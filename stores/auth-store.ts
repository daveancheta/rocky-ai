import { createAuthClient } from "better-auth/client";
import { create } from "zustand";

interface User {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string;
    createdAt: string;
    updatedAt: string;
}

interface AuthState {
    auth: User | null;
    isLoading: boolean;
    handleGetSession: () => Promise<void>;
    signinWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const authClient = createAuthClient();

export const AuthStore = create<AuthState>((set) => ({
    auth: null,
    isLoading: true,

    signinWithGoogle: async () => {
        try {
            await authClient.signIn.social({
                provider: "google",
            });
        } catch (error) {
            console.error("Error signing in with Google:", error);
        }
    },

    signOut: async () => {
        try {
            const response = await fetch("/api/auth/signout", {
                method: "POST",
                credentials: "include",
            });

            if (!response.ok) {
                throw new Error("Sign out request failed.");
            }

            set({ auth: null });
        } catch (error) {
            console.error("Error signing out:", error);
        }
    },

    handleGetSession: async () => {
        set({ isLoading: true });
        try {
            const response = await fetch("/api/auth/session");
            const data = await response.json();

            set({ auth: data.session?.user ?? null });
        } catch (error) {
            console.error("Error fetching session:", error);
            set({ auth: null });
        } finally {
            set({ isLoading: false });
        }
    }
}))
