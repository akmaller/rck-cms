"use client";

import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";

import { cn } from "@/lib/utils";

const ToggleGroup = ToggleGroupPrimitive.Root;

const ToggleGroupItem = ({ className, ...props }: ToggleGroupPrimitive.ToggleGroupItemProps) => (
  <ToggleGroupPrimitive.Item
    className={cn(
      "inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
);

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
