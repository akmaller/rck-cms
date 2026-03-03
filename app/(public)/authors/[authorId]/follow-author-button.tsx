"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2, UserCheck, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { toggleFollowAuthorAction } from "./actions";

type FollowAuthorButtonProps = {
  authorId: string;
  initialFollowing: boolean;
  initialFollowerCount: number;
  isAuthenticated: boolean;
  isOwnProfile: boolean;
};

export function FollowAuthorButton({
  authorId,
  initialFollowing,
  initialFollowerCount,
  isAuthenticated,
  isOwnProfile,
}: FollowAuthorButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [following, setFollowing] = useState(initialFollowing);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [error, setError] = useState<string | null>(null);

  if (isOwnProfile) {
    return (
      <p className="text-xs text-muted-foreground">Ini adalah profil Anda.</p>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-2">
        <Button asChild size="sm" variant="outline" className="w-fit">
          <Link href={`/login?callbackUrl=${encodeURIComponent(`/authors/${authorId}`)}`}>
            Masuk untuk ikuti
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground">
          {followerCount.toLocaleString("id-ID")} pengikut
        </p>
      </div>
    );
  }

  const handleToggleFollow = () => {
    if (isPending) {
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await toggleFollowAuthorAction(authorId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setFollowing(result.following);
      setFollowerCount(result.followerCount);
    });
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant={following ? "outline" : "default"}
        className="w-fit"
        onClick={handleToggleFollow}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : following ? (
          <UserCheck className="mr-2 h-4 w-4" aria-hidden="true" />
        ) : (
          <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        {following ? "Mengikuti" : "Ikuti"}
      </Button>
      <p className="text-xs text-muted-foreground">
        {followerCount.toLocaleString("id-ID")} pengikut
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
