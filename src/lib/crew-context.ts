"use client";
import { createContext, useContext } from "react";
import type { CrewMember } from "./types";

export const CrewContext = createContext<CrewMember[]>([]);
export function useCrew() {
  return useContext(CrewContext);
}
