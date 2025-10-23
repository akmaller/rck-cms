import { type JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";

export type MenuTreeNode = {
  id: string;
  title: string;
  slug: string | null;
  url: string | null;
  order: number;
  children: MenuTreeNode[];
};

type MenuTreeProps = {
  items: MenuTreeNode[];
};

function renderNode(node: MenuTreeNode): JSX.Element {
  return (
    <div key={node.id} className="space-y-1">
      <div className="flex items-center justify-between rounded-md border border-border/60 bg-card/70 px-3 py-2">
        <div>
          <p className="text-sm font-medium text-foreground">
            {node.title} <span className="text-xs text-muted-foreground">(#{node.order})</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {node.url ? node.url : node.slug ? `/${node.slug}` : "Tanpa tautan"}
          </p>
        </div>
      </div>
      {node.children.length > 0 ? (
        <div className="space-y-1 border-l border-border/60 pl-4">
          {node.children.map((child) => renderNode(child))}
        </div>
      ) : null}
    </div>
  );
}

export function MenuTree({ items }: MenuTreeProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Menu belum memiliki item. Tambahkan item baru dari form di samping.
        </CardContent>
      </Card>
    );
  }

  return <div className="space-y-2">{items.map((item) => renderNode(item))}</div>;
}
