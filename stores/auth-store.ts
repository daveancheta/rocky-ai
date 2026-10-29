import { createAuthClient } from "better-auth/client";
import { create } from "zustand";

interface AuthState {
    signinWithGoogle: () => Promise<void>;
}

const authClient = createAuthClient();

export const AuthStore = create<AuthState>((set) => ({
    signinWithGoogle: async () => {
        await authClient.signIn.social({
            provider: "google",
        });
    }
}))                                                                         