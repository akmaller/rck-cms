"use client";

import { useEffect } from "react";

import { useDashboardHeader } from "./dashboard-header-context";

type DashboardHeadingProps = {
  heading?: string;
  description?: string;
};

export function DashboardHeading({ heading, description }: DashboardHeadingProps) {
  const { setState } = useDashboardHeader();

  useEffect(() => {
    setState({ heading, description });
    return () => {
      setState({ heading: undefined, description: undefined });
    };
  }, [heading, description, setState]);

  return null;
}
