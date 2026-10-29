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
    handleGetSession: () => Promise<void>;
    signinWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const authClient = createAuthClient();

export const AuthStore = create<AuthState>((set) => ({
    auth: null,

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
            await authClient.signOut();
            set({ auth: null });
        } catch (error) {
            console.error("Error signing out:", error);
        }
    },

    signout: async () => {
        try {
            await fetch("/api/auth/signout", {
                method: "POST",
                credentials: "include",
            })
        } catch (error) {
            console.error("Error signing out:", error);
        }
    },

    handleGetSession: async () => {
        try {
            const response = await fetch("/api/auth/session");
            const data = await response.json();

            set({ auth: data.session.user });
        } catch (error) {
            console.error("Error fetching session:", error);
        }
    }
}))
