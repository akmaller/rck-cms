import NextAuth from "next-auth";
import type { NextAuthResult } from "next-auth";

import { authConfig } from "./auth.config";

const authHandler: NextAuthResult = NextAuth(authConfig);

export const handlers = authHandler.handlers;
export const auth: NextAuthResult["auth"] = authHandler.auth;
export const signIn: NextAuthResult["signIn"] = authHandler.signIn;
export const signOut: NextAuthResult["signOut"] = authHandler.signOut;
